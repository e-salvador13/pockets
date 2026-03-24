'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if onboarding is complete
    try {
      const raw = localStorage.getItem('cashpilot_user');
      if (raw) {
        const user = JSON.parse(raw);
        if (user.onboardingComplete) {
          router.replace('/chat');
          return;
        }
      }
    } catch {
      // Fall through to onboarding
    }
    router.replace('/onboarding');
  }, [router]);

  // Loading state while checking
  return (
    <div
      className="flex min-h-dvh items-center justify-center"
      style={{ background: '#0A0A0F' }}
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
        style={{ borderColor: '#4ADE80', borderTopColor: 'transparent' }}
      />
    </div>
  );
}
