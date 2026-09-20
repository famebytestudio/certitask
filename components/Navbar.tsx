"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "./Button";
import { Logo } from "./Logo";

export const Navbar = () => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "How It Works", href: "/how-it-works" },
    { name: "Clients", href: "/clients" },
    { name: "Pricing", href: "/pricing" },
    { name: "Browse Projects", href: "/projects" },
    { name: "Verify Certificate", href: "/verify" },
    { name: "Contact", href: "/contact" },
  ];

  const isActive = (href: string) => {
    if (href.startsWith("/#")) {
      return false; // Anchor links are not active pages
    }
    if (href === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(href);
  };

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-navy-dark/95 backdrop-blur-md shadow-md border-b border-gold/15"
          : "bg-navy-dark text-paper border-b border-paper/10"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-[76px]">
          {/* Logo Section */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <Logo className="h-10 w-10 transition-transform group-hover:scale-105" />
              <span className="font-sans font-bold text-2xl tracking-[-0.04em] text-paper">
                Certi<span className="text-gold">Task</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1 lg:space-x-4">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.name}
                  href={link.href}
                    className={`px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors relative ${
                    active
                      ? "text-gold"
                      : "text-paper/85 hover:text-gold"
                  }`}
                >
                  {link.name}
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gold rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Get Started Button */}
          <div className="hidden lg:flex items-center space-x-3">
            <Button href="/auth/signup" variant="gold">
              Get Started
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-paper hover:text-gold hover:bg-navy/5 focus:outline-hidden transition-colors"
              aria-controls="mobile-menu"
              aria-expanded={isOpen}
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? (
                <svg
                  className="block h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="block h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden transition-all duration-300 ease-in-out ${
          isOpen
            ? "max-h-screen opacity-100 visible"
            : "max-h-0 opacity-0 invisible overflow-hidden"
        } bg-navy-dark border-b border-gold/15`}
        id="mobile-menu"
      >
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`block px-3 py-3 rounded-md text-base font-semibold transition-colors ${
                  active
                    ? "bg-navy text-gold"
                    : "text-paper hover:bg-navy/30 hover:text-gold"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
          <div className="pt-4 pb-2 border-t border-paper/10 px-3 flex flex-col gap-2">
            <Button
              href="/auth/signup"
              variant="gold"
              className="w-full justify-center animate-pulse"
              onClick={() => setIsOpen(false)}
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};
