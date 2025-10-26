import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { nextauth, nextUrl } = req;
    const token = nextauth.token;
    const callbackUrl = `${nextUrl.pathname}${nextUrl.search}`;

    if (!token) {
      const signInUrl = nextUrl.clone();
      signInUrl.pathname = "/sign-in";
      signInUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(signInUrl);
    }

    const role = token.role as string | undefined;

    if (nextUrl.pathname.startsWith("/admin") && role !== "ADMIN") {
      const unauthorizedUrl = nextUrl.clone();
      unauthorizedUrl.pathname = "/unauthorized";
      return NextResponse.redirect(unauthorizedUrl);
    }

    if (nextUrl.pathname.startsWith("/proctor") && !["ADMIN", "PROCTOR"].includes(role ?? "")) {
      const unauthorizedUrl = nextUrl.clone();
      unauthorizedUrl.pathname = "/unauthorized";
      return NextResponse.redirect(unauthorizedUrl);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: () => true
    }
  }
);

export const config = {
  matcher: ["/admin/:path*", "/proctor/:path*"]
};
