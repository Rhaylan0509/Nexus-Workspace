# Google Agenda no Nexus Workspace

O calendário usa o OAuth do Firebase Authentication e chama a API Google Calendar diretamente no navegador. A autorização solicita `calendar.events.owned` para consultar, criar e remover eventos em calendários pertencentes à conta, além de `drive.file` para manter o acesso ao Drive existente.

## Configuração para testar

1. No Google Cloud Console, abra o projeto Firebase `omega-surge-hsmzh` e habilite **Google Calendar API** em APIs e serviços.
2. No Firebase Console, confirme que Google está habilitado em **Authentication → Sign-in method**.
3. Em **Authentication → Settings → Authorized domains**, inclua `localhost` e o domínio usado pelo app no Render.
4. No Google Auth Platform, configure a tela de consentimento e adicione `https://www.googleapis.com/auth/calendar.events.owned` como escopo. Se o app estiver em modo de teste, inclua sua conta Google entre os usuários de teste.
5. Inicie o app, abra **Calendário → Conectar Google Agenda** e aceite o consentimento.

Os eventos existentes no mês visível são carregados. Tarefas e eventos criados enquanto desconectado ficam no navegador e são enviados uma vez ao Google Agenda quando a conta é conectada. Compromissos criados já conectados são adicionados ao calendário principal, com lembrete pop-up do Google Agenda configurado de zero a cinco dias antes.

O token OAuth fica apenas em memória no navegador e precisa ser renovado após recarregar a página ou expirar. Para publicar o app para outras pessoas, o app OAuth pode precisar passar pelo processo de verificação do Google.
