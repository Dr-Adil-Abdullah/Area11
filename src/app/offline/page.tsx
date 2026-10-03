// Area11 — jab shop PC ka server bilkul na mile (internet/LAN dono band)
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">📴</div>
        <h1 className="text-lg font-bold">App abhi server tak nahi pahunch rahi</h1>
        <p className="mt-2 text-sm text-gray-600">
          Jo safha khula tha woh cache se dikh raha hai. Data dikhane / mehfooz karne ke liye
          shop wale computer (server) ka chalna zaroori hai.
        </p>
        <ul className="mt-3 list-inside list-disc text-left text-sm text-gray-600">
          <li>Dekhein ke shop PC par app chal rahi hai (<code>npm start</code>).</li>
          <li>Wi-Fi / LAN cable theek hai?</li>
          <li>Phir yeh safha dobara kholen ya niche “Dobara koshish” dabayein.</li>
        </ul>
        <a href="/" className="mt-4 inline-block rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
          Dobara koshish karein
        </a>
      </div>
    </main>
  );
}
