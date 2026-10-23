# Put your HTML website online

The website itself is just **index.html**. Download that file and double-click it to try the collage. Until shared storage is connected, it says **saved in this browser · preview**. Uploads and layouts are saved only in that browser. Keep the file at the same location to use the same browser storage, or use **download backup** to keep a portable copy. No terminal, Node.js or npm is needed to use the site.

## 1. Create the shared storage

1. Open <https://supabase.com/dashboard> and create an account.
2. Click **New project**, name it `hawlink`, and choose a nearby region. Keep your database password private.
3. When it is ready, open **SQL Editor** → **New query**.
4. Copy everything from [supabase-setup.sql](supabase-setup.sql), paste it into the query, and click **Run**. This creates private storage and rules restricting each account to its own collection.
5. Find the **Project URL** and **publishable key** in the project's **Connect** dialog or API settings. These are public browser connection details and are safe to share with the developer. A legacy `anon` key also works. Never share a `secret` key, `service_role` key, database password, or personal access token.

The developer can put those two public values into `const CLOUD = { url: '', key: '' };` in `index.html`. They are currently blank: **real shared storage is not connected yet**.

## 2. Give the website an address

1. In this GitHub repository, open **Settings** → **Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Choose **main** and **/ (root)**, then **Save**.
4. Wait for deployment. Open the address shown in **Pages**. The expected address is <https://hawliee.github.io/hawlink/>, but it only works after Pages has been enabled and deployed. Pages availability depends on repository visibility and your GitHub plan.

No workflow or build command is required. Updating `index.html` on `main` updates the site when Pages redeploys. Pages serves the website; Supabase holds the collection and uploaded images.

## 3. Sign in and sync

1. In Supabase, open **Authentication** → **URL Configuration**. Set **Site URL** to your actual website address and add that address to **Redirect URLs**. For the expected Pages address, use `https://hawliee.github.io/hawlink/`. Email confirmation can then return to your site.
2. On the website, choose **sign in to sync**, enter your email and a password of at least eight characters, and choose **create account**.
3. Confirm your email if asked, then sign in.
4. Use the **same account** on your phone and computer. Layouts, topics, image links, colour and uploads save online. Open devices check for updates every few seconds.

The Supabase dashboard account and the website's email/password account are separate. The website never asks for your database password.

Your unsigned preview is kept separately. To bring it into your online account, download a backup before signing in, then **restore backup** after signing in. Restore replaces the current collection after confirmation; embedded preview uploads transfer into private online storage.

## Privacy and backups

The HTML and bundled starter photographs are public on Pages. Personal boards and uploaded photos are private to the website account: database row rules and private storage policies check the signed-in user. Other accounts get separate collections. Browse/edit controls do not publish your collection.

Offline preview backups include image data. Online backups contain private storage references; they restore only in the original account while its files remain in Supabase. Back up Supabase storage separately for a full independent cloud backup. Removing an image from a collage leaves the stored original. Supabase plan limits and retention policies apply.

## Validation status

The HTML works directly from a file or a static host. Shared saving needs the project above. Automated tests with a mock service can verify the browser and storage protocol, but do not validate the real project or its access policies. No live Supabase project or Pages deployment has been verified yet.
