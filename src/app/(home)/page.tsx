import { ProjectForm } from "@/modules/home/ui/components/project-form";
import { ProjectsList } from "@/modules/home/ui/components/projects-list";
import Image from "next/image";

export default function Page() {
  return (
    <div className="min-h-screen w-full bg-black relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 110% 70% at 25% 80%, rgba(147, 51, 234, 0.12), transparent 55%),
            radial-gradient(ellipse 130% 60% at 75% 15%, rgba(59, 130, 246, 0.10), transparent 65%),
            radial-gradient(ellipse 80% 90% at 20% 30%, rgba(236, 72, 153, 0.14), transparent 50%),
            radial-gradient(ellipse 100% 40% at 60% 70%, rgba(16, 185, 129, 0.08), transparent 45%),
            #000000
          `,
        }}
      />

      <div className="relative z-10 flex flex-col max-w-5xl mx-auto w-full">
        <section className="space-y-6 py-[16vh] 2xl:py-48">
          <div className="flex flex-col items-center">
            <Image
              src="/logo.png"
              alt="Rushed"
              width={90}
              height={90}
              className="hidden md:block"
            />
          </div>
          <h1 className="text-2xl md:text-5xl font-bold text-center">
            mSpace: Explore, Create, and Discover.
          </h1>
          <div className="max-w-3xl mx-auto w-full">
            <ProjectForm />
          </div>
        </section>
        <ProjectsList />
      </div>
    </div>
  );
}
