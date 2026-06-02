// Bare-chrome layout for printable pages — no sidebar, no nav, no admin
// shell. Lets the operator click "Print" and get a clean card / slip with
// nothing else on the page.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
