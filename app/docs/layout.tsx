import { DocsNavigation } from "@/components/docs/DocsNavigation";

export default function DocsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <DocsNavigation />
      {children}
    </>
  );
}