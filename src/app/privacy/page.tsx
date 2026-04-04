export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-sm leading-relaxed">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-gray-500 mb-10">Last updated: April 2026</p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Overview</h2>
        <p className="text-gray-700">
          Life Planner is a personal productivity app for planning trips and meals. This policy explains what data we collect, how we use it, and your rights. We take your privacy seriously and collect only what is necessary to provide the service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Information We Collect</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li>
            <strong>Account information</strong> — When you sign in with Google, we receive your name, email address, and profile picture from Google.
          </li>
          <li>
            <strong>Google Calendar access</strong> — If you grant permission, we access your Google Calendar solely to create, update, and delete events corresponding to your trip activities. We do not read your existing calendar events.
          </li>
          <li>
            <strong>Trip and meal data</strong> — Content you create in the app (trips, activities, meal plans) is stored in our database and associated with your account.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">How We Use Your Information</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li>To provide and operate the app</li>
          <li>To sync your trip activities to your Google Calendar when you enable that feature</li>
          <li>To authenticate you securely via Google OAuth</li>
        </ul>
        <p className="mt-3 text-gray-700">
          We do not sell your data, use it for advertising, or share it with third parties except as required to operate the service (e.g., Supabase for database hosting, Google APIs for calendar sync).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Google API Services</h2>
        <p className="text-gray-700">
          Life Planner uses Google APIs to authenticate users and optionally sync trip activities to Google Calendar. Our use of Google user data complies with the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. We only use the data received from Google APIs to provide and improve the features you explicitly request.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Data Storage & Security</h2>
        <p className="text-gray-700">
          Your data is stored securely using Supabase with row-level security, meaning only you can access your own data. OAuth tokens are stored encrypted and used only to fulfill calendar sync requests you initiate.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Data Retention & Deletion</h2>
        <p className="text-gray-700">
          Your data is retained as long as your account is active. To request deletion of your account and all associated data, contact us at the email below. We will delete your data within 30 days.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Revoking Google Access</h2>
        <p className="text-gray-700">
          You can revoke Life Planner&apos;s access to your Google account at any time via{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Google Account Permissions
          </a>
          . Revoking access will disable calendar sync but will not delete your Life Planner data.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Contact</h2>
        <p className="text-gray-700">
          If you have any questions about this privacy policy or your data, please contact:{" "}
          <a href="mailto:theoyeh@gmail.com" className="text-blue-600 underline">
            theoyeh@gmail.com
          </a>
        </p>
      </section>
    </main>
  );
}
