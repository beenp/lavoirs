import { Link } from 'react-router-dom';
import { ArrowRight, Users, Sparkles, MapPin } from 'lucide-react';

export default function HomePage({ nextPath }: { nextPath: string }) {
  return <section className="page-content">
    <div className="eyebrow">YOUR NEXT ADVENTURE STARTS HERE</div>
    <h1>Your people.<br/>Your interests.<br/><em>Your next adventure.</em></h1>
    <p className="muted">Four people. Shared interests. A conversation that could turn into something great.</p>
    <div className="surface room-prompt" id="how-it-works">
      <h2>Good company. Just a hello away.</h2>
      <div className="what-next">
        <p><Users size={20}/><span><strong>Find your party of four</strong>Meet people nearby who love what you love.</span></p>
        <p><Sparkles size={20}/><span><strong>Skip the awkward start</strong>A little icebreaker gets the conversation going.</span></p>
        <p><MapPin size={20}/><span><strong>Take it offline</strong>Discover something fun to do together.</span></p>
      </div>
    </div>
    <Link className="primary" to={nextPath}>Let’s jump in<ArrowRight size={18}/></Link>
  </section>;
}
