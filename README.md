# FinanFlow — controle financeiro pessoal

Site responsivo, totalmente estático na hospedagem, com **login real**, cadastro de usuários, banco de dados privado, controle de receitas/despesas e **relatório em imagem PNG** de todas as contas pendentes do mês.

**Não requer servidor próprio, Node.js, instalação ou etapa de build.** Pode ser publicado diretamente no GitHub Pages.

## Funcionalidades

- Login, cadastro, logout e recuperação de senha por e-mail com Supabase Auth.
- Cada conta acessa **somente os próprios dados** (Postgres + Row Level Security).
- Receitas e despesas com descrição, categoria, valor, vencimento, observação e status de pagamento.
- Painel com receitas previstas, despesas, valor pendente e saldo previsto.
- Filtro por mês, pesquisa, categorias de despesas e atualização rápida de pagamento.
- Geração de **PNG** das contas pendentes do mês (valor total, cada despesa, categoria e vencimento).
- Botão para compartilhar a imagem em celulares/navegadores compatíveis; em outros dispositivos, faça o download e envie normalmente.
- Exportação do mês para **CSV** com caracteres compatíveis com Excel em português.
- **Modo demonstração** sem cadastro, com dados ilustrativos salvos apenas neste navegador.
- Layout adaptado para computador e celular.

## 1. Testar sem configurar nada

Abra `index.html` no navegador e clique em **Explorar demonstração**. Experimente cadastrar despesas, marcar como pagas e gerar uma imagem.

> Os dados da demonstração ficam no `localStorage` do navegador e não são protegidos por login. Não use a demonstração para guardar informações confidenciais ou dados importantes.

## 2. Ativar login verdadeiro e armazenamento online (Supabase)

O GitHub Pages publica **arquivos estáticos**. Para manter contas independentes, autenticação e dados salvos online de forma adequada, o FinanFlow usa o Supabase.

1. Crie um projeto em [supabase.com](https://supabase.com/) (existe opção gratuita, sujeita aos limites do serviço).
2. No painel do Supabase, abra **SQL Editor** e execute **todo o conteúdo** de [`supabase.sql`](supabase.sql).
3. Vá a **Project Settings → API Keys** (ou **Connect**) e obtenha:
   - **Project URL**: `https://SEU-PROJETO.supabase.co`.
   - **Publishable key** (`sb_publishable_...`) ou a chave pública antiga `anon` (`eyJ...`).
4. Abra [`config.js`](config.js) e preencha:

   ```js
   window.FINANFLOW_CONFIG = {
     supabaseUrl: "https://SEU-PROJETO.supabase.co",
     supabaseKey: "SUA_CHAVE_PUBLICAVEL"
   };
   ```
5. Em **Authentication → Providers → Email**, deixe habilitada a autenticação por e-mail. Para usuários reais, mantenha **Confirmação de e-mail** ativada.
6. Em **Authentication → URL Configuration**, configure a **Site URL** como o endereço publicado do seu site (por exemplo, `https://seuusuario.github.io/finanflow/`) e inclua o mesmo endereço em **Redirect URLs**. Se testar localmente, adicione também `http://localhost:5500/**` ou a porta que estiver utilizando.
7. Salve as alterações e teste **Criar conta**, confirme o e-mail e faça **Login**.

**IMPORTANTE:** nunca insira `service_role`, `sb_secret_...`, senhas de banco ou outra chave secreta no `config.js` ou no GitHub. **Somente a chave pública publishable/anon** pode ficar no código do site, e o arquivo SQL ativa as regras de acesso (**RLS**) que separam os dados de cada usuário.

### Sobre a confirmação de e-mail

No serviço gratuito, pode haver limites para o envio de e-mails de confirmação, além de restrições do remetente padrão. Consulte a configuração de SMTP se quiser oferecer cadastros em maior escala. Para testes iniciais, confirme que os e-mails chegam e verifique a pasta de spam.

## 3. Publicar no GitHub Pages

1. No GitHub, crie um repositório, por exemplo **`finanflow`**.
2. Envie os arquivos deste projeto **para a raiz do repositório**. Se você baixou o ZIP, **extraia o conteúdo** primeiro e envie os arquivos (`index.html`, `app.js`, `style.css`, `config.js`, `supabase.sql` etc.), não somente o `.zip`.
3. Abra **Settings → Pages** no repositório.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Selecione **`main`** e **`/(root)`**, então **Save**.
6. O endereço normalmente fica `https://SEU-USUARIO.github.io/finanflow/`.
7. Copie esse endereço para a configuração de URLs do Supabase mencionada na etapa 2.

Nenhuma etapa de compilação e nenhum workflow de GitHub Actions são necessários. O arquivo `.nojekyll` impede que o Pages aplique processamento Jekyll não desejado.

**Observação:** se o repositório for público, o código-fonte e o `config.js` público também serão. Isso é esperado na arquitetura do Supabase, **desde que** você use somente a chave publicável e mantenha a RLS configurada.

## 4. Testar localmente por servidor HTTP

Para testar as rotas de login e os links de confirmação/recuperação de senha localmente, sirva os arquivos por HTTP:

```bash
python -m http.server 5500
```

Abra <http://localhost:5500>. Se tiver o VS Code, também pode usar a extensão Live Server, configurando a URL permitida no Supabase.

## Como gerar a imagem

1. Faça login (ou use a demonstração).
2. Cadastre contas como **Despesa** e deixe a opção de pago **desmarcada**.
3. Selecione o mês desejado.
4. Clique em **Gerar imagem de pendências**.
5. Confira a prévia, clique em **Baixar PNG** ou, quando disponível, **Compartilhar**.

O relatório **ignora receitas e despesas já pagas** e mostra **todas** as despesas pendentes do mês escolhido. Não inclui nome, e-mail, senha nem identificadores de conta na imagem. Revise os dados antes de enviar a outras pessoas.

## Estrutura

```text
finanflow/
├── index.html       # Telas, formulários e interface
├── style.css        # Visual responsivo
├── app.js           # Lógica, Supabase, CSV e geração PNG
├── config.js        # URL e chave PUBLICÁVEL do Supabase
├── supabase.sql     # Banco de dados e regras de privacidade (RLS)
├── favicon.svg      # Ícone do site
├── .nojekyll        # Evita processamento Jekyll do Pages
├── .gitignore
├── LICENSE
└── README.md
```

## Privacidade e limites

- Lançamentos com **login real** ficam no projeto Supabase configurado, não no GitHub nem no navegador. Sessões de login são persistidas pelo SDK do Supabase no navegador.
- A demonstração utiliza `localStorage` e não sincroniza. Dados da demonstração **não migram automaticamente** para sua conta real.
- O relatório é gerado localmente com Canvas: suas informações não são enviadas a outro serviço para fazer a imagem. Ao **compartilhar**, a imagem será enviada ao aplicativo/destinatário que você escolher.
- A exportação CSV inclui todos os lançamentos do **mês selecionado**. Guarde backups periódicos dos dados se forem importantes.
- Isso é uma ferramenta de organização pessoal, não um sistema bancário/contábil certificado. Tenha cautela com dados sensíveis e revise as configurações do Supabase antes de compartilhar o site publicamente.
- Dependências externas: biblioteca JavaScript Supabase hospedada no jsDelivr, Google Fonts e acesso ao serviço Supabase para contas reais. O modo demonstração funciona mesmo sem configurar um backend.

## Licença

MIT. Livre para modificar, utilizar e publicar.
