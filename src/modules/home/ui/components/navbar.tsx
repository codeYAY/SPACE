"use client";

import { Button } from "@/components/ui/button";
import { UserControl } from "@/components/user-control";
import { useScroll } from "@/hooks/use-scroll";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { User } from "@supabase/supabase-js";
import { Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export const Navbar = () => {
  const isScrolled = useScroll();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    getUser();
  }, [supabase]);

  return (
    <nav
      className={cn(
        `p-4 bg-transparent fixed top-0 left-0 right-0 z-50 transition-all duration-200 border-b border-transparent`,
        isScrolled && "bg-background border-border"
      )}
    >
      <div className="max-w-5xl mx-auto w-full flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="mSpace" width={32} height={32} />
          <span className="font-semibold text-lg">mSpace</span>
          <span className="ml-1 px-1.5 py-px text-[10px] font-medium rounded bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200">
            Development
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {!loading && (
            <>
              {!user ? (
                <div className="flex gap-2">
                  <Link href="/sign-up">
                    <Button variant="outline" size="sm">
                      Join the Waitlist
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <Link href="/settings">
                    <Button variant="ghost" size="icon">
                      <Settings className="h-5 w-5" />
                    </Button>
                  </Link>

                  <UserControl />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
