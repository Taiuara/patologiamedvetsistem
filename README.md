# KoprowPath

Aplicação web responsiva KoprowPath para registros de patologia veterinária, com identidade visual verde-musgo e roxa, autenticação por e-mail e senha, persistência de formulários no Cloud Firestore e armazenamento de imagens no Firebase Storage.

## Configuração do Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/) e cadastre um aplicativo Web.
2. Copie os dados da configuração do SDK para `firebase-config.js`.
3. Em **Authentication → Sign-in method**, habilite **E-mail/senha** e cadastre os usuários autorizados.
4. Crie o banco **Cloud Firestore** e habilite **Storage**.
5. Publique as regras abaixo para restringir registros e arquivos ao usuário autorizado. O UID permitido está definido em `firebase-config.js`. Valide e adapte as regras à política de retenção e ao fluxo de acesso da sua instituição antes de usar dados reais.
6. Configure o CORS do bucket para permitir envios de imagens pelo navegador. O arquivo `cors.json` contém as origens local e publicada. Para exibir imagens, o aplicativo solicita uma URL de download pela sessão Firebase e deixa o navegador carregar a imagem diretamente; isso evita downloads binários bloqueados pela política de CORS do navegador.

Envie a versão atualizada do arquivo `cors.json` para o Cloud Shell e aplique-a no bucket `patovet-148a7.firebasestorage.app`:

```text
gcloud storage buckets update gs://patovet-148a7.firebasestorage.app --cors-file=cors.json
```

Execute o comando em uma pasta que contenha `cors.json`, com o Google Cloud CLI autenticado na conta que administra o projeto `patovet-148a7`. Se o Live Server usar outra porta ou o sistema estiver publicado em outro endereço, adicione a origem exata, incluindo protocolo e porta. Não use `*`: as imagens são carregadas por chamadas autenticadas e o bucket deve permanecer privado.

Regras iniciais para o Firestore:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/records/{recordId} {
      allow read, write: if request.auth != null
        && request.auth.uid == userId
        && request.auth.uid == 'Cbpk1DE58LYHu2kAO9fnkn9ifAe2';
    }
  }
}
```

Regras iniciais para o Storage:

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/images/{fileName} {
      allow read: if request.auth != null
        && request.auth.uid == userId
        && request.auth.uid == 'Cbpk1DE58LYHu2kAO9fnkn9ifAe2';
      allow write: if request.auth != null
        && request.auth.uid == userId
        && request.auth.uid == 'Cbpk1DE58LYHu2kAO9fnkn9ifAe2'
        && (request.resource == null
          || (request.resource.size < 10 * 1024 * 1024
            && request.resource.contentType.matches('image/.*')));
    }
  }
}
```

## Executar localmente

Sirva a pasta por um servidor HTTP local (por exemplo, a extensão Live Server do VS Code). O uso dos módulos do Firebase não funciona ao abrir `index.html` diretamente via `file://`.

## Publicar no Firebase Hosting

O site é estático e está configurado para publicar os arquivos da aplicação no Firebase Hosting do projeto `patovet-148a7`. Com o Firebase CLI autenticado, execute na raiz do projeto:

```text
firebase deploy --only hosting --project patovet-148a7
```

Endereço padrão do site: https://patovet-148a7.web.app. A configuração ignora `README.md` e `cors.json`.

### Publicação automática pelo GitHub

O workflow `.github/workflows/deploy-firebase-hosting.yml` publica automaticamente no canal `live` quando há um push para `main`. Antes de funcionar:

1. A branch `main` e o workflow precisam estar no repositório GitHub.
2. Crie uma conta de serviço no projeto Google Cloud `patovet-148a7` com a função **Firebase Hosting Admin**.
3. Crie uma chave JSON para essa conta e adicione o conteúdo completo como secret de Actions do repositório:
   **Settings → Secrets and variables → Actions → New repository secret**.
4. Use exatamente o nome `FIREBASE_SERVICE_ACCOUNT_PATOVET_148A7`.
5. Depois de salvar o secret, cada push para `main` iniciará uma publicação. Também é possível iniciar manualmente em **Actions → Deploy Firebase Hosting → Run workflow**.

Nunca adicione a chave JSON ao repositório, a um arquivo `.js` ou a mensagens. Se a política da organização bloquear chaves de conta de serviço, configure Workload Identity Federation e ajuste o workflow antes de ativar a automação.

Os registros são privados por conta Firebase e organizados em `users/{uid}/records`. Imagens ficam em `users/{uid}/images`. URLs de download do Firebase Storage são URLs com token de acesso: não as compartilhe, pois quem tiver a URL poderá visualizar a imagem. Casos clínicos têm nome obrigatório para facilitar sua organização. Formulários clínicos são salvos por paciente e categoria; parâmetros são salvos por espécie, idade e painel, mostrando espécie e idade no início de cada registro; bactérias, medicamentos e fluidoterapia são mantidos como registros reutilizáveis, sem identificação de paciente. Fungos também permite anexar imagens sem identificação de paciente. As listas abaixo dos formulários mostram os registros salvos e permitem visualizar, editar e excluir. Os parâmetros ficam listados logo abaixo do respectivo formulário.
