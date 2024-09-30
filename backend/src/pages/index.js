import { Inter } from "next/font/google";
import Head from "next/head";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <>
      <Head>
        <title>La leña Pizza</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div
        className={`flex h-screen items-center justify-center ${inter.className}`}
      >
        <h1 className="text-4xl font-bold">La leña Pizza</h1>
      </div>
    </>
  );
}
