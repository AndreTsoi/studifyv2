import Dashboard from "@/components/dashboard";
export default function History() {
  return (
    <>
      <div
        style={{
          padding: "12px 25px",
          background: "#eeecfa",
          position: "relative",
          zIndex: 10,
        }}
      >
        <a href="/">← Back to study journal</a> · Earlier session tracker &
        reports
      </div>
      <Dashboard />
    </>
  );
}
