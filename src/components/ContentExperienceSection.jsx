export default function ContentExperienceSection() {
  return (
    <section
      className="content-experience-section relative isolate flex h-screen w-full overflow-hidden bg-black text-white"
      aria-labelledby="content-experience-title"
    >
      <div
        className="absolute inset-0 -z-20 bg-cover bg-center bg-no-repeat motion-safe:scale-[1.03] motion-safe:animate-[contentExperienceDrift_18s_ease-in-out_infinite_alternate]"
        style={{
          backgroundImage: "url('/images/content-experience-banner.jpg')",
        }}
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(0,0,0,0.8)_0%,rgba(0,0,0,0.62)_34%,rgba(0,0,0,0.22)_62%,rgba(0,0,0,0.02)_100%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 flex h-full w-full items-center px-6 py-20 sm:px-10 lg:px-16 xl:px-24">
        <div className="max-w-[650px]">
          <p className="mb-5 text-xs font-black uppercase tracking-normal text-[#d7b46a] sm:text-sm">
            Content Experience Add-On
          </p>

          <h2
            id="content-experience-title"
            className="max-w-[9ch] font-serif text-6xl font-black leading-[0.88] tracking-normal text-white sm:text-7xl lg:text-8xl xl:text-9xl"
          >
            More Than A Rental
          </h2>

          <div className="mt-7 h-px w-28 bg-gradient-to-r from-[#f0ce83] via-[#d7b46a] to-transparent" />

          <p className="mt-7 max-w-[500px] text-lg font-medium leading-8 text-white/90 sm:text-xl">
            Book the car. Add the photographer. Capture the experience.
          </p>

          <div className="mt-7 flex flex-wrap gap-2.5" aria-label="Content experience includes">
            <span className="inline-flex min-h-9 items-center rounded-full border border-[#d7b46a]/40 bg-black/35 px-3.5 text-xs font-black text-white/90 backdrop-blur-md">
              Edited photos
            </span>
            <span className="inline-flex min-h-9 items-center rounded-full border border-[#d7b46a]/40 bg-black/35 px-3.5 text-xs font-black text-white/90 backdrop-blur-md">
              Reels-ready clips
            </span>
            <span className="inline-flex min-h-9 items-center rounded-full border border-[#d7b46a]/40 bg-black/35 px-3.5 text-xs font-black text-white/90 backdrop-blur-md">
              VIP locations
            </span>
          </div>

          <a
            href="sms:+13105550123"
            className="mt-9 inline-flex min-h-14 items-center justify-center rounded-full bg-[#d7b46a] px-8 text-sm font-black uppercase tracking-normal text-black shadow-[0_22px_60px_rgba(215,180,106,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#f0ce83] hover:shadow-[0_26px_72px_rgba(215,180,106,0.36)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f0ce83]"
          >
            Add Photographer
          </a>
        </div>
      </div>

      <style>{`
        @keyframes contentExperienceDrift {
          from {
            transform: scale(1.03) translate3d(0, 0, 0);
          }
          to {
            transform: scale(1.08) translate3d(-1.4%, 0, 0);
          }
        }

        @media (max-width: 768px) {
          .content-experience-section {
            height: 100svh;
          }
        }
      `}</style>
    </section>
  );
}
