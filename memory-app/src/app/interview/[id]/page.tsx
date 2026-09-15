import { InterviewScreen } from "@/components/interview-screen";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InterviewScreen id={id} />;
}
