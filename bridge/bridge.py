from __future__ import annotations

import csv
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

import requests
from dotenv import load_dotenv


BRIDGE_DIR = Path(__file__).resolve().parent
load_dotenv(BRIDGE_DIR / ".env")

BRIDGE_URL = os.environ.get("NEXUS_BRIDGE_URL", "https://nexus-workspace-92zg.onrender.com").rstrip("/")
BRIDGE_TOKEN = os.environ.get("BRIDGE_API_TOKEN", "")
POLL_SECONDS = max(2, int(os.environ.get("NEXUS_BRIDGE_POLL_SECONDS", "3")))
TEMP_ROOT = Path(os.environ.get("XOURNAL_TEMP_DIR", r"C:\TempXournal"))


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
    if os.name != "nt" or not sys.platform.startswith("win"):
        raise SystemExit("A bridge do Xournal++ só pode ser executada no Windows.")
    if not BRIDGE_TOKEN:
        raise SystemExit("Configure BRIDGE_API_TOKEN no arquivo .env desta pasta.")
    if not re.match(r"^https?://", BRIDGE_URL):
        raise SystemExit("NEXUS_BRIDGE_URL deve começar com http:// ou https://.")

    executable = find_xournal_executable()
    session = requests.Session()
    print(f"Bridge Nexus ativa · Xournal++: {executable}")
    print(f"Servidor: {BRIDGE_URL} · consulta a cada {POLL_SECONDS}s")

    while True:
        try:
            job = claim_next_job(session)
            if not job:
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
        except requests.RequestException as error:
            print(f"Servidor indisponível: {error}. Tentando novamente em {POLL_SECONDS}s.")
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
