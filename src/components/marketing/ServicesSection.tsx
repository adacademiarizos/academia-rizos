import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import ServiceSectionCard from "./ServiceSectionCard";
import { site } from '@/content/site';

gsap.registerPlugin(ScrollTrigger);

const {services} = site

export default function ServiceSection() {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    const track:HTMLDivElement | null = trackRef.current;

    if (!section || !track) return;

    function setupHorizontalScroll() {
        if (!track) return;
      ScrollTrigger.getAll().forEach(t => t.kill());

      const totalScroll = track.scrollWidth - window.innerWidth;

      gsap.to(track, {
        x: -totalScroll,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${track.scrollWidth}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        }
      });

      ScrollTrigger.refresh();
    }

    setupHorizontalScroll();

    const handleResize = () => setupHorizontalScroll();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <section 
      ref={sectionRef}
      className="relative h-screen overflow-hidden"
    >
      <div 
        ref={trackRef}
        className="flex h-screen will-change-transform"
      >
        {
          services.map(res => (
            <div key={res.title} className="w-screen h-screen shrink-0">
              <ServiceSectionCard 
                title={res.title}
                desc={res.desc} 
                duration={res.duration} 
                from={res.from}
                href={res.href} 
                imgUri={res.imgUri} 
              />
            </div>
          ))
        }
        
      </div>
    </section>
  );
}