import 'leaflet/dist/leaflet.css';
import '@/styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import Layout from '@/components/Layout';
import LocationOnboardingModal from '@/components/LocationOnboardingModal';

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Layout>
        <Component {...pageProps} />
        <LocationOnboardingModal />
      </Layout>
    </SessionProvider>
  );
}
