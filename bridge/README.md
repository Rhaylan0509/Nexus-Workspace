# Bridge local do Xournal++

A bridge roda no Windows, consulta a fila do Nexus no Render, baixa a nota enviada pelo navegador, abre o Xournal++ e devolve o arquivo editado ao Nexus. O navegador usa a autorização Google Drive já conectada ao app para baixar e atualizar a nota. A bridge não precisa de cliente OAuth, `credentials.json`, `token.json` nem acesso próprio ao Google Drive.

## Requisitos

- Windows 10/11, Python 3.10 ou mais recente e Xournal++ instalado.
- O Nexus precisa estar implantado no Render com um disco persistente montado em `/var/data` e `BRIDGE_DATA_DIR=/var/data`.
- O `BRIDGE_API_TOKEN` no Render deve ser igual ao da bridge local. Esse token é usado somente entre o serviço Render e a bridge Windows.

## Preparação no Windows

1. Copie `bridge/.env.example` para `bridge/.env`.
2. Defina `NEXUS_BRIDGE_URL` com o endereço do seu site e use o mesmo `BRIDGE_API_TOKEN` configurado no Render.
3. Se o Xournal++ não estiver em um caminho padrão ou no PATH, defina `XOURNALPP_EXE` com o caminho do executável.
4. No PowerShell, dentro da pasta `bridge`, instale e inicie:

   ```powershell
   py -m pip install -r requirements.txt
   py bridge.py
   ```

5. Conecte o Google Drive no Nexus, sincronize a nota e clique em **Editar no Xournal++**. Mantenha o site aberto até a atualização da nota no Drive terminar.

Feche as outras janelas do Xournal++ antes de iniciar a edição pelo Nexus. A bridge usa uma subpasta própria dentro de `C:\TempXournal` e remove os arquivos temporários depois que o Xournal++ fecha.

## Fluxo de dados

1. O site baixa a nota do Drive usando a autorização Google já existente no navegador.
2. O site envia o arquivo à fila protegida do Nexus.
3. A bridge Windows baixa o arquivo da fila e abre o Xournal++.
4. Ao fechar o Xournal++, a bridge devolve o arquivo editado ao Nexus.
5. O site atualiza o mesmo arquivo no Google Drive e limpa o resultado temporário do servidor.
