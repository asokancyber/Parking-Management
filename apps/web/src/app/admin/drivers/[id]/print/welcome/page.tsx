import { Suspense } from 'react';
import WelcomePrintClient from './welcome-print-client';

export const dynamic = 'force-dynamic';

export default function Page({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <WelcomePrintClient id={params.id} />
    </Suspense>
  );
}
