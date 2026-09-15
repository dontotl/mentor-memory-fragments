import { MemoirScreen } from "@/components/memoir-screen";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MemoirScreen id={id} />;
}
