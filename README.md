# Grader / GradeScan — Backend + Item Analysis

This version keeps the current browser-based Grader app and adds cloud result sync plus per-item analysis. It is still a web app, not a native Android APK.

## Files
- `index.html` — answer key, answer-sheet generator, scanning/manual correction, results, Item Analysis, CSV export.
- `cloud.js` — Supabase sign-in/sign-up, cloud result save/load and sync status.
- `config.js` — your Supabase project URL and anon/publishable key.
- `supabase.sql` — database tables, RLS policies, profile trigger, scan counter.
- `admin.html` — admin dashboard for users and recent results.

## Scanning
- The printed answer sheet has four choices: **A, B, C, D**.
- On the **Answer sheet** tab, set how many items to print (1–100) or use the 20/25/50/100 shortcuts.
- The live camera outlines the four corner markers and shows **Move closer**, **Move farther**, or **Hold still**. When the page is aligned at a good distance, it captures automatically. Untick **Auto-capture** to use the Capture button instead.

## Supabase setup
1. Create a project at https://supabase.com.
2. Open **SQL Editor** and run the complete `supabase.sql` file. It is written to add the new columns to an existing version too.
3. In **Project Settings → API**, copy the Project URL and public anon/publishable key into `config.js`. Never put a `service_role` or secret key in a browser file.
4. In **Authentication → URL Configuration**, set the Site URL to your deployed app URL and add it to the allowed redirect URLs. For GitHub Pages, use `https://jme548129.github.io/Grader-app/`.
5. Deploy the files to a static HTTPS host such as GitHub Pages. Camera access usually requires HTTPS (or localhost).
6. Open `index.html`, create an account and sign in. If **Confirm email** is enabled, click the confirmation link before logging in. Results are saved locally first and then synced to Supabase when signed in and online. For many users, configure custom SMTP so Supabase's built-in email rate limit does not block sign-ups.

## Set an admin
After the account has been created, run this in Supabase SQL Editor, replacing the email:

```sql
insert into public.admins(user_id)
select id from auth.users where email = 'your-email@example.com'
on conflict do nothing;
```

Then open `admin.html` while signed in using that account.

## Item Analysis guide
- **Difficulty p** = number of students correct on an item divided by the number of saved results for that exam. Blank answers count as incorrect.
- **Discrimination D** = proportion correct in the higher-scoring group minus proportion correct in the lower-scoring group. The app uses the top and bottom 27% groups when at least four student results exist.
- A negative or low discrimination value is a signal to review the item, not an automatic verdict. Small classes make these statistics less stable.
- Analysis groups saved results by the currently selected exam type and title. Keep the exam title consistent for one exam. Each new saved result stores an answer-key snapshot so later key edits do not rewrite the key used for that result.
- CSV export can be copied into Excel or Google Sheets.

## Important notes
- The app is a browser-based web app; this change does not compile an APK.
- Existing results saved before this update may not contain their original answer key. For those records, analysis falls back to the current answer key, so verify the key before relying on their item statistics.
- Cloud sync needs the Supabase project URL/key, database SQL, internet, and a signed-in user. The app still keeps local results if cloud sync fails.
- Test with sample answer sheets and a test Supabase project before using it for official grades. Do not publish student data publicly.
