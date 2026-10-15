# Bridge local do Xournal++ (Windows)

A bridge fica consultando a API do Nexus. Quando recebe uma tarefa, baixa o arquivo do Drive para uma subpasta exclusiva em `C:\TempXournal`, abre o Xournal++, espera o processo encerrar, atualiza o mesmo arquivo no Google Drive e remove somente a subpasta daquele trabalho.

## Requisitos

- Windows 10/11, Python 3.10 ou mais recente e Xournal++ instalado.
- Google Calendar não é necessário. A bridge usa o Google Drive API.
- O servidor precisa manter o arquivo de fila entre reinicializações. No Render, monte um disco persistente em `/var/data`, use uma instância do serviço e configure `BRIDGE_DATA_DIR=/var/data`.

## Preparação local

1. Na raiz do projeto, copie `.env.example` para `.env` e defina um segredo aleatório longo em `BRIDGE_API_TOKEN`. Exemplo para gerar no PowerShell: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
2. Na pasta `bridge`, copie `.env.example` para `.env`, reutilize exatamente o mesmo `BRIDGE_API_TOKEN` e deixe `NEXUS_BRIDGE_URL=http://localhost:4173`.
3. Crie no mesmo projeto Google Cloud do Firebase um cliente OAuth do tipo **Aplicativo para computador**. Habilite Google Drive API e baixe o JSON para `bridge/credentials.json`. Esse arquivo e `token.json` são ignorados pelo Git.
4. No PowerShell, entre na pasta `bridge` e execute:

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   py bridge.py
   ```

5. Na primeira execução, o navegador abrirá a autorização Google para `drive.file`. Aceite com a mesma conta Google conectada ao Nexus.
6. No Nexus, conecte o Google Drive e clique **Sincronizar com Drive** uma vez para criar a cópia editável e registrar o ID do arquivo. Abra o `.xopp` e clique **Editar no Xournal++**. Na primeira utilização, cole o `BRIDGE_API_TOKEN` do `.env` do servidor no campo solicitado.

Feche todas as janelas já abertas do Xournal++ antes de iniciar um trabalho pela bridge. Isso garante que a bridge acompanhe o processo que ela abriu e só atualize o Drive depois que você fechar essa janela. A ponte usa uma pasta diferente para cada tarefa e não remove outros arquivos de `C:\TempXournal`.

## Render

Configure `BRIDGE_API_TOKEN` como variável secreta do serviço e `BRIDGE_DATA_DIR=/var/data` para o disco persistente. No `.env` local da bridge, mude `NEXUS_BRIDGE_URL` para o endereço HTTPS do serviço Render e mantenha o mesmo token. O token nunca deve ser colocado no código do frontend ou commitado.

O navegador precisa permanecer aberto durante a edição para mostrar o progresso e recarregar a versão atualizada no app ao final. Mesmo que ele seja fechado, a bridge local ainda envia o arquivo ao Drive e registra a conclusão no servidor.
