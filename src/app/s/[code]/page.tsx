import { SessionRoom } from "@/components/session/SessionRoom";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <SessionRoom code={code.toUpperCase()} />;
}
