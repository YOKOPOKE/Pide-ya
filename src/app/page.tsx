import Link from "next/link";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer"; // Static import to fix build

// Lazy Load Heavy Components
const Menu = dynamic(() => import("@/components/Menu"), {
  loading: () => <div className="min-h-screen bg-white animate-pulse" />
});
const Location = dynamic(() => import("@/components/Location"), {
  loading: () => <div className="h-96 bg-gray-50 animate-pulse" />
});
const OrderFlow = dynamic(() => import("@/components/OrderFlow"));

export default function Home() {
  return (
    <main className="min-h-screen bg-yoko-light">
      <Navbar />
      <CartDrawer /> {/* Render Drawer */}
      <Hero />
      <Menu />
      <OrderFlow /> {/* Contains ProductSelector and Builder */}
      <Location />
      <Footer />
    </main>
  );
}
