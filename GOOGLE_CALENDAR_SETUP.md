# Google Agenda no Nexus Workspace

## Autorizar o Google Drive no Render

O login do Drive usa Firebase Authentication. Se o app mostrar `auth/unauthorized-domain`, o domínio precisa ser autorizado no projeto Firebase; essa permissão não pode ser concedida pelo código do frontend.

1. No Firebase Console, abra o projeto `omega-surge-hsmzh` e vá a **Authentication → Settings → Authorized domains**.
2. Adicione o host do Render sem protocolo nem caminho: `nexus-workspace-92zg.onrender.com`.
3. Em **Authentication → Sign-in method**, confirme que o provedor **Google** está ativado.
4. No Google Cloud Console do mesmo projeto, habilite **Google Drive API** e, se a tela de consentimento OAuth estiver em modo de teste, adicione a conta que fará o login como usuário de teste.
5. Recarregue o app publicado e tente conectar de novo. A alteração de domínio no Firebase normalmente não exige novo deploy.

O app agora exibe o código/cause de erros OAuth conhecidos e orienta sobre o domínio bloqueado, provedor desligado, popup e falha de rede.

O calendário usa o OAuth do Firebase Authentication e chama a API Google Calendar diretamente no navegador. A autorização solicita `calendar.events.owned` para consultar, criar e remover eventos em calendários pertencentes à conta, além do escopo `drive` para localizar e sincronizar a pasta Nexus Workspace compartilhada com o aplicativo desktop.

O escopo `drive` permite tecnicamente que o site veja, edite, crie e exclua arquivos em todo o Google Drive. O código de sincronização do site restringe suas operações à pasta `Nexus Workspace`, mas a tela de consentimento do Google informa o acesso amplo. Ao reconectar, revise e aceite a nova permissão. Como site e desktop usam clientes OAuth diferentes, o escopo menor `drive.file` não permite ao site descobrir uma pasta criada pelo desktop.

## Configuração para testar

1. No Google Cloud Console, abra o projeto Firebase `omega-surge-hsmzh` e habilite **Google Calendar API** em APIs e serviços.
2. No Firebase Console, confirme que Google está habilitado em **Authentication → Sign-in method**.
3. Em **Authentication → Settings → Authorized domains**, inclua `localhost` e o domínio usado pelo app no Render.
4. No Google Auth Platform, configure a tela de consentimento e adicione `https://www.googleapis.com/auth/calendar.events.owned` como escopo. Se o app estiver em modo de teste, inclua sua conta Google entre os usuários de teste.
5. Inicie o app, abra **Calendário → Conectar Google Agenda** e aceite o consentimento.

Os eventos existentes no mês visível são carregados. Tarefas e eventos criados enquanto desconectado ficam no navegador e são enviados uma vez ao Google Agenda quando a conta é conectada. Compromissos criados já conectados são adicionados ao calendário principal, com lembrete pop-up do Google Agenda configurado de zero a cinco dias antes.

O token OAuth fica apenas em memória no navegador e precisa ser renovado após recarregar a página ou expirar. Para publicar o app para outras pessoas, o app OAuth pode precisar passar pelo processo de verificação do Google.
