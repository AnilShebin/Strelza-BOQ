"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface NotFoundPageProps {
  onGoHome?: () => void;
}

export function NotFoundPage({ onGoHome }: NotFoundPageProps) {
  const handleGoHome = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <section className="bg-white dark:bg-zinc-950 font-serif min-h-screen flex items-center justify-center select-none w-full">
      <div className="container mx-auto px-4">
        <div className="flex justify-center">
          <div className="w-full sm:w-10/12 md:w-8/12 text-center">
            <div
              className="bg-[url(https://cdn.dribbble.com/users/285475/screenshots/2083086/dribbble_1.gif)] h-[250px] sm:h-[350px] md:h-[400px] bg-center bg-no-repeat bg-contain"
              aria-hidden="true"
            >
              <h1 className="text-center text-black dark:text-white text-6xl sm:text-7xl md:text-8xl pt-6 sm:pt-8 font-extrabold tracking-tight">
                404
              </h1>
            </div>

            <div className="mt-[-50px]">
              <h3 className="text-2xl text-black dark:text-white sm:text-3xl font-bold mb-3 font-sans">
                Look like you're lost
              </h3>
              <p className="mb-6 text-zinc-600 dark:text-zinc-400 sm:mb-5 font-sans text-sm md:text-base">
                The page you are looking for is not available!
              </p>

              <Button
                variant="default"
                onClick={handleGoHome}
                className="my-5 bg-emerald-600 hover:bg-emerald-700 text-white font-sans px-6 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
              >
                Go to Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PageNotFoundDemo({ onGoHome }: { onGoHome?: () => void }) {
  return (
    <div className="w-full h-full min-h-screen">
      <NotFoundPage onGoHome={onGoHome} />
    </div>
  );
}
