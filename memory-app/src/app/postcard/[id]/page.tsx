import { PostcardScreen } from "@/components/postcard-screen";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PostcardScreen id={id} />;
}
