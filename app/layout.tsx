import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prompt Guide",
  description: "Prompt engineering learning labs with AI feedback"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">Home</Link>
          <Link href="/labs">Labs</Link>
          <Link href="/login">Log in</Link>
          <Link href="/signup">Sign up</Link>
          <form action="/logout" method="post">
            <button type="submit">Log out</button>
          </form>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
