import DriverDetailClient from './driver-detail-client';

export const dynamic = 'force-dynamic';

export default function Page({ params }: { params: { id: string } }) {
  return <DriverDetailClient id={params.id} />;
}
