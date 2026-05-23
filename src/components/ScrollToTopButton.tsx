import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const [hasActiveFooter, setHasActiveFooter] = useState(false);
  const circleRef = useRef<SVGCircleElement | null>(null);

  useEffect(() => {
    const scrollContainer = document.querySelector("[data-scroll-container='app-main']") as HTMLElement | null;

    const handleScroll = () => {
      let scrollTop = 0;
      let docHeight = 0;

      if (scrollContainer) {
        scrollTop = scrollContainer.scrollTop;
        const scrollHeight = scrollContainer.scrollHeight;
        const clientHeight = scrollContainer.clientHeight;
        docHeight = scrollHeight - clientHeight;
      } else {
        scrollTop = window.scrollY;
        docHeight = document.documentElement.scrollHeight - window.innerHeight;
      }

      const progress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;

      // Direct DOM write — bypasses React entirely, no re-render chain
      if (circleRef.current) {
        circleRef.current.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - progress));
      }

      // Check if a sticky bottom action footer is visible on the page
      const footer = document.querySelector('.sticky.bottom-0');
      const isFooterVisible = !!(footer && !footer.classList.contains('opacity-0'));
      setHasActiveFooter(isFooterVisible);

      // State only drives visibility — updates are infrequent (threshold cross)
      setIsVisible(scrollTop > 120);
    };

    handleScroll();

    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    } else {
      window.addEventListener("scroll", handleScroll, { passive: true });
    }

    // Set up window resize listener in case container size changes
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", handleScroll);
      } else {
        window.removeEventListener("scroll", handleScroll);
      }
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    const scrollContainer = document.querySelector("[data-scroll-container='app-main']") as HTMLElement | null;

    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      aria-hidden={!isVisible}
      className={`fixed right-5 sm:right-7 z-40
        transition-all duration-300 ease-out
        ${hasActiveFooter 
          ? "bottom-[84px] sm:bottom-[96px]" 
          : "bottom-5 sm:bottom-7"
        }
        ${isVisible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-3 pointer-events-none"
        }`}
    >
      <div className="relative w-16 h-16">
        {/* SVG ring */}
        <svg
          width="64" height="64"
          viewBox="0 0 64 64"
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Track ring */}
          <circle
            cx="32" cy="32" r={RADIUS}
            stroke="currentColor"
            strokeWidth="3.5"
            fill="none"
            className="text-primary/15"
          />
          {/* Progress arc — strokeDashoffset updated directly via ref */}
          <circle
            ref={circleRef}
            cx="32" cy="32" r={RADIUS}
            stroke="currentColor"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE}
            className="text-primary"
            style={{ transition: "stroke-dashoffset 100ms linear" }}
          />
        </svg>

        {/* Button sits centered inside the ring */}
        <button
          onClick={scrollToTop}
          tabIndex={isVisible ? 0 : -1}
          className="
            absolute inset-0 m-auto
            w-10 h-10
            bg-primary hover:bg-primary/90 text-primary-foreground
            rounded-full shadow-md
            flex items-center justify-center
            active:scale-90
            transition-[background-color,transform] duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          "
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-4 h-4" strokeWidth="2.5" />
        </button>
      </div>
    </div>
  );
}