"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const Page = () => {
  return (
    <div className="flex flex-col max-w-3xl mx-auto w-full">
      <section className="space-y-6 pt-[16vh] 2xl:pt-48">
        <div className="flex flex-col items-center gap-3 text-center">
          <Badge variant="secondary" className="w-fit">
            Early access
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold">Packs</h1>
          <p className="text-muted-foreground text-base md:text-lg">
            Billing is paused while we finish the launch. mSpace is free to use
            right now.
          </p>
        </div>

        <Card className="border-dashed">
          <CardHeader className="gap-2">
            <CardTitle className="text-3xl md:text-4xl">
              Free while in pilot
            </CardTitle>
            <CardDescription className="text-base">
              Every workspace, feature, and integration is available at no cost
              until billing returns. We will give you at least 30 days notice
              before charging.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm md:text-base text-muted-foreground">
            <p>
              Explore, Create, and Discover without limits. Explore public, private, and personal spaces. spaces.
            </p>
            <p>
              Need invoicing or have procurement requirements? Reach out and
              we&apos;ll reserve discounted founder pricing for you.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              Have questions about pricing? Let’s chat.
            </p>
            <Button asChild>
              <Link href="mailto:info@mstro.ai">Contact us</Link>
            </Button>
          </CardFooter>
        </Card>
      </section>
    </div>
  );
};

export default Page;
