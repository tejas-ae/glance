import RoomClient from "@/components/RoomClient";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <RoomClient roomId={decodeURIComponent(roomId)} />;
}
