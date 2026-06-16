import "./globals.css";
import MainLayout from "../components/MainLayout";

export const metadata = {
  title: "Chình App",
  description: "Skill-based pickleball matchmaking and events.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-black">
        <MainLayout>
          {children}
        </MainLayout>
      </body>
    </html>
  );
}