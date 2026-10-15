# Bridge local do Xournal++

A bridge conecta o Nexus Workspace hospedado no Render ao Xournal++ instalado no Windows. Ela só inicia quando você clica em **Abrir no Xournal++**. O navegador pede autorização para abrir o protocolo local `nexusworkspace://`; depois que você fecha o Xournal++, a bridge envia a nota de volta, apaga a pasta temporária da edição e encerra.

O site não consegue instalar ou executar um programa Python silenciosamente. Por isso, a associação do protocolo é instalada uma vez no perfil atual do Windows. Não é necessário iniciar a bridge junto com o Windows.

## Requisitos

- Windows 10/11, Python 3.10 ou mais recente e Xournal++ instalado.
- O serviço Nexus no Render precisa ter um disco persistente montado em `/var/data` e `BRIDGE_DATA_DIR=/var/data`.
- `BRIDGE_API_TOKEN` no Render e em `bridge/.env` devem ter o mesmo valor.

## Configuração única no Windows

1. Baixe/clonar o projeto e abra o PowerShell na pasta `bridge`.
2. Copie `.env.example` para `.env`; configure o endereço do Render e o mesmo `BRIDGE_API_TOKEN` definido nas variáveis do serviço no Render. Mantenha esse token privado.
3. Se o Xournal++ estiver instalado em um caminho fora dos locais padrão, defina `XOURNALPP_EXE` em `.env`.
4. Instale as dependências e registre o protocolo para seu usuário:

   ```powershell
   py -m pip install -r requirements.txt
   Set-ExecutionPolicy -Scope Process Bypass
   .\install-protocol.ps1
   ```

   O registro fica em `HKEY_CURRENT_USER`, portanto não pede privilégio de administrador. Para desfazer, execute `uninstall-protocol.ps1` na mesma pasta.

## Uso

1. No Nexus, conecte o Google Drive e sincronize a nota `.xopp` ou `.xoj`.
2. Clique em **Abrir no Xournal++** e aceite a solicitação do navegador para abrir o aplicativo local.
3. Edite e salve a nota no Xournal++. Feche o programa para a bridge devolver a versão atualizada ao Drive.
4. O processo da bridge termina sozinho. Os arquivos temporários da nota são apagados de `C:\TempXournal`.

Feche todas as janelas do Xournal++ antes de iniciar a edição pelo Nexus. Se o navegador não mostrar a solicitação ou o botão informar que a bridge não iniciou, confirme a configuração acima e tente novamente.

## Fluxo de dados

1. O site baixa a nota do Drive usando a autorização Google já conectada no navegador.
2. O site envia a nota para a fila protegida do Nexus.
3. O navegador abre a bridge local após sua autorização; a bridge baixa a nota e inicia o Xournal++.
4. Ao fechar o Xournal++, a bridge devolve a nota editada e remove a cópia temporária local.
5. O site atualiza o mesmo arquivo no Google Drive e remove o resultado temporário no servidor.
