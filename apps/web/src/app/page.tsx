export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "4rem auto", padding: "1rem", fontFamily: "system-ui" }}>
      <h1>RaktDoot</h1>
      <p>Member 2 backend foundation is running.</p>
      <p>Request creation, protected retrieval, public hospital lookup and centre discovery are available through the API. The donor and coordinator screens are not implemented yet.</p>
      <p><strong>Development demo only.</strong> Seed hospitals, centres, donors and stock are fictional. This is not an emergency medical service. Follow your treating hospital’s guidance.</p>
      <a href="/api/centres">Inspect synthetic hospital choices</a>
    </main>
  );
}