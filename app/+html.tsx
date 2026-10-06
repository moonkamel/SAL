import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Script de suivi impact.com (affiliation Ticketmaster), demandé dans le <head> de la page d'accueil.
// Site web uniquement : ce fichier n'existe pas dans l'app Android.
const IMPACT_UTT = `(function(i,m,p,a,c,t){c.ire_o=p;c[p]=c[p]||function(){(c[p].a=c[p].a||[]).push(arguments)};t=a.createElement(m);var z=a.getElementsByTagName(m)[0];t.async=1;t.src=i;z.parentNode.insertBefore(t,z)})('https://utt.impactcdn.com/P-A7876906-a8ac-49b9-8df2-c84e178eea4f1.js','script','impactStat',document,window);impactStat('transformLinks');impactStat('trackImpression');`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <script type="text/javascript" dangerouslySetInnerHTML={{ __html: IMPACT_UTT }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
