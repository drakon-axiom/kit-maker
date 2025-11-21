import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ArrowRight, Shield, Zap, Users } from 'lucide-react';

const brandContent = {
  'axiom-collective': {
    title: 'Axiom Collective - Premium Manufacturing Solutions',
    description: 'Your trusted partner for high-quality manufacturing and wholesale solutions. Excellence in every bottle.',
    hero: {
      headline: 'Premium Manufacturing Excellence',
      subheadline: 'Delivering quality products and exceptional service to businesses nationwide',
      cta: 'Get Started Today',
    },
    features: [
      {
        icon: Shield,
        title: 'Quality Assured',
        description: 'Rigorous quality control ensures every product meets the highest standards',
      },
      {
        icon: Zap,
        title: 'Fast Turnaround',
        description: 'Efficient production processes deliver your orders on time, every time',
      },
      {
        icon: Users,
        title: 'Dedicated Support',
        description: 'Expert team ready to assist with your unique business needs',
      },
    ],
    benefits: [
      'ISO-certified manufacturing facilities',
      'Customizable product solutions',
      'Competitive wholesale pricing',
      'Real-time order tracking',
      'Dedicated account management',
      'Flexible payment terms',
    ],
  },
  'nexus-aminos': {
    title: 'Nexus Aminos - Premium Amino Acid Solutions',
    description: 'The leading provider of pharmaceutical-grade amino acids for researchers and professionals. Purity you can trust.',
    hero: {
      headline: 'Pure Excellence in Amino Acids',
      subheadline: 'Pharmaceutical-grade amino acid solutions for research and professional applications',
      cta: 'Shop Now',
    },
    features: [
      {
        icon: Shield,
        title: 'Pharmaceutical Grade',
        description: 'USP-verified amino acids with certificates of analysis for every batch',
      },
      {
        icon: Zap,
        title: 'Fast Shipping',
        description: 'Same-day processing with temperature-controlled shipping nationwide',
      },
      {
        icon: Users,
        title: 'Expert Support',
        description: 'Scientific team available to answer technical questions',
      },
    ],
    benefits: [
      '99.9%+ purity guaranteed',
      'Third-party lab tested',
      'Temperature-controlled storage',
      'Bulk pricing available',
      'Research-grade quality',
      'Sterile packaging options',
    ],
  },
  'bac-water-store': {
    title: 'The Bac Water Store - Bacteriostatic Water Solutions',
    description: 'Premium bacteriostatic water for reconstitution. Medical-grade quality for professionals and researchers.',
    hero: {
      headline: 'Medical-Grade Bacteriostatic Water',
      subheadline: 'Sterile, pharmaceutical-grade bacteriostatic water for reconstitution applications',
      cta: 'Order Now',
    },
    features: [
      {
        icon: Shield,
        title: 'USP Standards',
        description: 'Meets USP <797> standards for pharmaceutical compounding',
      },
      {
        icon: Zap,
        title: 'Quick Delivery',
        description: 'Fast, discreet shipping with temperature monitoring',
      },
      {
        icon: Users,
        title: 'Trusted Source',
        description: 'Serving medical professionals and researchers since 2020',
      },
    ],
    benefits: [
      'USP-grade sterile water',
      '0.9% benzyl alcohol preservative',
      'Multi-use vials available',
      'Sealed and tamper-evident',
      'Lot tracking for quality',
      'Volume discounts',
    ],
  },
};

const Landing = () => {
  const { user } = useAuth();
  const { currentBrand, loading } = useBrand();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const brandSlug = currentBrand?.slug || 'axiom-collective';
  const content = brandContent[brandSlug as keyof typeof brandContent] || brandContent['axiom-collective'];

  return (
    <>
      <Helmet>
        <title>{content.title}</title>
        <meta name="description" content={content.description} />
        <meta property="og:title" content={content.title} />
        <meta property="og:description" content={content.description} />
        <meta name="twitter:title" content={content.title} />
        <meta name="twitter:description" content={content.description} />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        {/* Header */}
        <header className="border-b bg-card/50 backdrop-blur">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              {currentBrand?.logo_url ? (
                <img src={currentBrand.logo_url} alt={currentBrand.name} className="h-8" />
              ) : (
                <h1 className="text-xl font-bold">{currentBrand?.name}</h1>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/admin-login')} className="text-xs">
                Admin
              </Button>
              <Button variant="ghost" onClick={() => navigate('/auth')}>
                Customer Sign In
              </Button>
              <Button onClick={() => navigate('/wholesale-signup')}>
                Apply Now
              </Button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              {content.hero.headline}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {content.hero.subheadline}
            </p>
            <div className="flex gap-4 justify-center pt-4">
              <Button size="lg" onClick={() => navigate('/auth')} className="gap-2">
                {content.hero.cta}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/wholesale-signup')}>
                Apply for Wholesale
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {content.features.map((feature, index) => (
              <Card key={index} className="border-2">
                <CardHeader>
                  <feature.icon className="h-12 w-12 mb-4 text-primary" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Benefits Section */}
        <section className="container mx-auto px-4 py-20 bg-card/50 rounded-lg">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Why Choose Us?</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {content.benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <p className="text-lg">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-4xl font-bold">Ready to Get Started?</h2>
            <p className="text-xl text-muted-foreground">
              Join hundreds of satisfied customers who trust us for their needs
            </p>
            <div className="flex gap-4 justify-center pt-4">
              <Button size="lg" onClick={() => navigate('/auth')} className="gap-2">
                Create Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t bg-card/50 backdrop-blur mt-20">
          <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} {currentBrand?.name}. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Landing;
