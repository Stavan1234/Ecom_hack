import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import Product from './pages/Product.jsx';
import Search from './pages/Search.jsx';
import { Cart, Checkout, OrderConfirmed } from './pages/Bag.jsx';
import { Login, Register } from './pages/Auth.jsx';
import { AccountLayout, Overview, Orders, OrderDetail, Wishlist, Settings } from './pages/Account.jsx';
import Admin from './pages/Admin.jsx';
import { About, Boutiques, Care, Contact, Journal, JournalArticle, NotFound, Policies } from './pages/Info.jsx';
import Engraving from './pages/Engraving.jsx';
import VipInvitation from './pages/VipInvitation.jsx';
import { LabLayout, LabHome, LabGlossary, LabEvidence } from './lab/LabHome.jsx';
import LabDetail from './lab/LabDetail.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/vip-invitation" element={<VipInvitation />} />
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="shop/:category" element={<Shop />} />
          <Route path="product/:slug" element={<Product />} />
          <Route path="search" element={<Search />} />
          <Route path="bag" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order-confirmed/:id" element={<OrderConfirmed />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="account" element={<AccountLayout />}>
            <Route index element={<Overview />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="wishlist" element={<Navigate to="/account/wishlist" replace />} />
          <Route path="admin" element={<Admin />} />
          <Route path="engraving" element={<Engraving />} />
          <Route path="about" element={<About />} />
          <Route path="boutiques" element={<Boutiques />} />
          <Route path="care" element={<Care />} />
          <Route path="contact" element={<Contact />} />
          <Route path="journal" element={<Journal />} />
          <Route path="journal/:slug" element={<JournalArticle />} />
          <Route path="policies/:topic" element={<Policies />} />
          <Route path="lab" element={<LabLayout />}>
            <Route index element={<LabHome />} />
            <Route path="glossary" element={<LabGlossary />} />
            <Route path="evidence" element={<LabEvidence />} />
            <Route path=":labId" element={<LabDetail />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
