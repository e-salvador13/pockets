'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = localStorage.getItem('pockets_user');
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

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
    </div>
  );
}
