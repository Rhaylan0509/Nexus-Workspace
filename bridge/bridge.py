from __future__ import annotations

import csv
import argparse
import gzip
import hashlib
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from urllib.parse import urlparse
import xml.etree.ElementTree as ET
from pathlib import Path

import requests
from dotenv import load_dotenv


BRIDGE_DIR = Path(__file__).resolve().parent
load_dotenv(BRIDGE_DIR / ".env")

BRIDGE_URL = os.environ.get("NEXUS_BRIDGE_URL", "https://nexus-workspace-92zg.onrender.com").rstrip("/")
BRIDGE_TOKEN = os.environ.get("BRIDGE_API_TOKEN", "")
POLL_SECONDS = max(2, int(os.environ.get("NEXUS_BRIDGE_POLL_SECONDS", "3")))
TEMP_ROOT = Path(os.environ.get("XOURNAL_TEMP_DIR", r"C:\TempXournal"))
ONCE_WAIT_SECONDS = max(30, int(os.environ.get("NEXUS_BRIDGE_ONCE_WAIT_SECONDS", "180")))


def find_xournal_executable() -> Path:
    configured = os.environ.get("XOURNALPP_EXE")
    candidates = [Path(configured)] if configured else []
    for command in ("xournalpp.exe", "xournal++.exe"):
        found = shutil.which(command)
        if found:
            candidates.append(Path(found))
    candidates.extend([
        Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Xournal++" / "bin" / "xournalpp.exe",
        Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Xournal++" / "xournalpp.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Xournal++" / "bin" / "xournalpp.exe",
    ])
    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()
    raise RuntimeError("Xournal++ não encontrado. Instale-o ou defina XOURNALPP_EXE no .env da bridge.")


def assert_xournal_closed(executable: Path) -> None:
    result = subprocess.run(["tasklist", "/FO", "CSV", "/NH"], capture_output=True, text=True, check=False)
    target = executable.name.casefold()
    for row in csv.reader(result.stdout.splitlines()):
        if row and row[0].casefold() == target:
            raise RuntimeError("Feche todas as janelas do Xournal++ antes de iniciar uma edição pelo Nexus.")


def bridge_headers() -> dict[str, str]:
    return {"X-Bridge-Token": BRIDGE_TOKEN}


def claim_next_job(session: requests.Session):
    response = session.get(f"{BRIDGE_URL}/api/bridge/next", headers=bridge_headers(), timeout=30)
    if response.status_code == 204:
        return None
    response.raise_for_status()
    return response.json()


def send_heartbeat(session: requests.Session, job_id: str, stop: threading.Event):
    while not stop.wait(25):
        try:
            session.post(
                f"{BRIDGE_URL}/api/bridge/jobs/{job_id}/heartbeat",
                headers=bridge_headers(),
                timeout=15,
            ).raise_for_status()
        except requests.RequestException as error:
            print(f"Aviso: não foi possível renovar a reserva da tarefa: {error}")


def download_bridge_file(session: requests.Session, job_id: str, destination: Path):
    with session.get(
        f"{BRIDGE_URL}/api/bridge/jobs/{job_id}/input",
        headers=bridge_headers(),
        stream=True,
        timeout=(15, 120),
    ) as response:
        response.raise_for_status()
        with destination.open("wb") as output:
            shutil.copyfileobj(response.raw, output)
        expected_sha256 = response.headers.get("X-Content-SHA256", "").lower()
        expected_size = response.headers.get("Content-Length")

    if not re.fullmatch(r"[0-9a-f]{64}", expected_sha256):
        raise RuntimeError("O servidor não enviou a verificação de integridade. Atualize o site no Render e tente novamente.")
    actual_size = destination.stat().st_size
    actual_sha256 = hashlib.sha256(destination.read_bytes()).hexdigest()
    if expected_size and actual_size != int(expected_size):
        raise RuntimeError(f"Download incompleto: o servidor enviou {expected_size} bytes, mas chegaram {actual_size}.")
    if actual_sha256 != expected_sha256:
        raise RuntimeError("A nota foi alterada ou truncada durante a transferência. Nenhum arquivo foi aberto no Xournal++.")


def validate_xournal_file(file_path: Path, suffix: str):
    try:
        if suffix == ".xopp":
            with gzip.open(file_path, "rb") as compressed_xml:
                root = ET.parse(compressed_xml).getroot()
        else:
            root = ET.parse(file_path).getroot()
        if root.tag.split("}")[-1] != "xournal":
            raise ET.ParseError("O elemento raiz não é xournal.")
    except (gzip.BadGzipFile, EOFError, ET.ParseError, OSError) as error:
        raise RuntimeError(
            "A versão baixada do Google Drive não é um documento Xournal++ íntegro. "
            "O arquivo não foi aberto nem substituído. Reenvie a nota original ao Drive e tente novamente."
        ) from error


def upload_bridge_result(session: requests.Session, job_id: str, source: Path):
    headers = {**bridge_headers(), "Content-Type": "application/octet-stream"}
    with source.open("rb") as input_file:
        response = session.put(
            f"{BRIDGE_URL}/api/bridge/jobs/{job_id}/result",
            headers=headers,
            data=input_file,
            timeout=(15, 300),
        )
        response.raise_for_status()


def process_job(session: requests.Session, executable: Path, job: dict):
    job_id = job["id"]
    file_name = Path(job["fileName"]).name
    suffix = Path(file_name).suffix.lower()
    if suffix not in {".xopp", ".xoj"}:
        raise RuntimeError("A tarefa recebida não aponta para um arquivo Xournal++ (.xopp/.xoj).")

    job_dir = TEMP_ROOT / job_id
    job_dir.mkdir(parents=True, exist_ok=False)
    local_file = job_dir / file_name
    stop_heartbeat = threading.Event()
    heartbeat_thread = threading.Thread(
        target=send_heartbeat,
        args=(session, job_id, stop_heartbeat),
        daemon=True,
    )

    try:
        assert_xournal_closed(executable)
        heartbeat_thread.start()
        print(f"Baixando {file_name} do Nexus…")
        download_bridge_file(session, job_id, local_file)
        if not local_file.is_file() or local_file.stat().st_size == 0:
            raise RuntimeError("O arquivo recebido do Nexus está vazio.")
        validate_xournal_file(local_file, suffix)
        print(f"Abrindo no Xournal++: {local_file}")
        process = subprocess.Popen([str(executable), str(local_file)], cwd=str(job_dir))
        exit_code = process.wait()
        if exit_code != 0:
            raise RuntimeError(f"O Xournal++ encerrou com código {exit_code}.")
        if not local_file.is_file():
            raise RuntimeError("O arquivo temporário não foi encontrado após fechar o Xournal++.")

        print("Devolvendo a nota editada ao Nexus…")
        upload_bridge_result(session, job_id, local_file)
        print(f"Edição devolvida ao site: {file_name}")
    finally:
        stop_heartbeat.set()
        if heartbeat_thread.is_alive():
            heartbeat_thread.join(timeout=2)
        if job_dir.parent.resolve() != TEMP_ROOT.resolve():
            raise RuntimeError("Caminho temporário inesperado; a limpeza foi interrompida por segurança.")
        shutil.rmtree(job_dir, ignore_errors=False)
        try:
            TEMP_ROOT.rmdir()
        except OSError:
            pass


def main():
    parser = argparse.ArgumentParser(description="Bridge local do Xournal++ para o Nexus Workspace.")
    parser.add_argument("--once", action="store_true", help="processa uma tarefa e encerra")
    parser.add_argument("protocol_url", nargs="?", help="URL nexusworkspace://open invocada pelo site")
    args = parser.parse_args()
    if os.name != "nt" or not sys.platform.startswith("win"):
        raise SystemExit("A bridge do Xournal++ só pode ser executada no Windows.")
    if args.protocol_url:
        parsed = urlparse(args.protocol_url)
        if parsed.scheme != "nexusworkspace" or parsed.netloc != "open" or parsed.path or parsed.query or parsed.fragment:
            raise SystemExit("Solicitação de abertura local inválida.")
    elif not args.once:
        raise SystemExit("Use o botão do Nexus para iniciar a bridge, ou execute com --once.")
    if not BRIDGE_TOKEN:
        raise SystemExit("Configure BRIDGE_API_TOKEN no arquivo .env desta pasta.")
    if not re.match(r"^https?://", BRIDGE_URL):
        raise SystemExit("NEXUS_BRIDGE_URL deve começar com http:// ou https://.")

    executable = find_xournal_executable()
    session = requests.Session()
    print(f"Bridge Nexus iniciada · Xournal++: {executable}")
    print(f"Servidor: {BRIDGE_URL} · consulta a cada {POLL_SECONDS}s")
    deadline = time.monotonic() + ONCE_WAIT_SECONDS if args.once else None

    while True:
        try:
            job = claim_next_job(session)
            if not job:
                if deadline is not None and time.monotonic() >= deadline:
                    print("Nenhuma tarefa chegou dentro do prazo. Encerrando a bridge.")
                    return
                time.sleep(POLL_SECONDS)
                continue
            print(f"Tarefa recebida: {job['fileName']} ({job['id']})")
            try:
                process_job(session, executable, job)
            except Exception as error:
                message = str(error)
                print(f"Falha ao editar {job.get('fileName', 'arquivo')}: {message}")
                try:
                    session.post(
                        f"{BRIDGE_URL}/api/bridge/jobs/{job['id']}/complete",
                        headers=bridge_headers(),
                        json={"ok": False, "error": message[:1000]},
                        timeout=30,
                    ).raise_for_status()
                except requests.RequestException as report_error:
                    print(f"Não foi possível avisar o servidor sobre a falha: {report_error}")
            if args.once:
                return
        except requests.RequestException as error:
            print(f"Servidor indisponível: {error}. Tentando novamente em {POLL_SECONDS}s.")
            if deadline is not None and time.monotonic() >= deadline:
                raise SystemExit("O servidor Nexus não respondeu dentro do prazo.") from error
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
