import CardPrintClient from './card-print-client';

export const dynamic = 'force-dynamic';

export default function Page({ params }: { params: { id: string } }) {
  return <CardPrintClient id={params.id} />;
}
