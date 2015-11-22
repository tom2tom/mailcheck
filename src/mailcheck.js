/*!
 * Mailcheck https://github.com/mailcheck/mailcheck
 * Author Derrick Ko (@derrickko)
 *
 * Released under the MIT License.
 *
 * v 1.2.0
 */
/*
API

 domains array (even if single-membered) of domains to be used instead
   of this.defaultDomains
 secondLevelDomains array (even if single-membered) of domains to be used instead
   of this.defaultSecondLevelDomains
 topLevelDomains array (even if single-membered) of domains to be used instead
   of this.defaultTopLevelDomains

Calculate similarity between 2 [sub]domain-names
 optional function distanceFunction(provideddomain,candidatedomain)
 returns value, smaller = better match between the arguments

Provide a suggested alternative address
 optional function suggested(suggestedaddress)
 returns nothing

Report that no address was found
 optional function empty()
 returns nothing

CHANGES

v.1.2.0
separate option for countryDomains
extra defaultDomains (including former defaultSecondLevelDomains) and defaultTopLevelDomains
better-targeted uses of empty()
deprecate suggest()
add check(target,opts)
cleanups from lint and other
*/

var Mailcheck = {
  domainThreshold: 2,
  secondLevelThreshold: 2,
  topLevelThreshold: 2,
  defaultDomains: ['aim.com','aol.com','att.net','bellsouth.net','btinternet.com',
    'charter.net','comcast.net','cox.net','earthlink.net','gmail.com','gmx.com',
    'hotmail.com','icloud.com','inbox.com','live.com','mac.com','mail.com','me.com',
    'msn.com','optonline.net','optusnet.com.au','outlook.com','qq.com','rocketmail.com',
    'rogers.com','sbcglobal.net','shaw.ca','sky.com','sympatico.ca','telus.net',
    'verizon.net','web.de','xtra.co.nz','yahoo.com','yandex.com','ymail.com','zoho.com'],
  defaultSecondLevelDomains: [],
  defaultTopLevelDomains: ['biz','co','com','edu','gov','info','mil','name','net','org'],
  defaultCountryDomains: ['at','au','be','ca','ch','cz','de','dk','es','eu',
    'fr','gr','hk','hu','ie','il','in','it','jp','kr','nl','no','nz','ru',
    'se','sg','tw','uk','us'],

 /* run() returns
  * a suggestion, if the supplied email approximates one that's acceptable,
  *   and the user has accepted the suggestion
  * true if the supplied email is empty
  * false (hence do nothing) if the supplied email is acceptable as-is,
  *   or is not recognised as 'close', or is not a valid address
  */
  run: function(opts) {
    var email = this.encodeEmail(opts.email),
        emailParts = this.splitEmail(email);
    if (emailParts === false) {
      return false;
    }
    var secondLevelDomains = opts.secondLevelDomains || this.defaultSecondLevelDomains;
    var topLevelDomains = opts.topLevelDomains || this.defaultTopLevelDomains;
    var countryDomains = opts.countryDomains || this.defaultCountryDomains;
    
    // If the address is (sufficiently) recognised, do not suggest anything
    if (topLevelDomains && topLevelDomains.indexOf(emailParts.topLevelDomain) !== -1) {
      if (emailParts.countryDomain === false || (countryDomains && countryDomains.indexOf(emailParts.countryDomain) !== -1)) {
        if (emailParts.secondLevelDomain === false || (secondLevelDomains && secondLevelDomains.indexOf(emailParts.secondLevelDomain) !== -1)) {
          return false;
        }
      }
    }

    var domains = opts.domains || this.defaultDomains;
    var distanceFunction = opts.distanceFunction || this.sift3Distance;
    var closestDomain = this.findClosestDomain(emailParts.domain, domains, distanceFunction, this.domainThreshold);

    if (closestDomain) {
      if (closestDomain == emailParts.domain) {
        // The email address exactly matches one of the supplied domains; do not return a suggestion.
        return false;
      } else {
        // The email address closely matches one of the supplied domains; return a suggestion
        return { address: emailParts.address, domain: closestDomain, full: emailParts.address + "@" + closestDomain };
      }
    }
    // The email address does not closely match one of the supplied domains
    if (emailParts.domain) {
      closestDomain = emailParts.domain;
      var rtrn = false;

      var closestSecondLevelDomain = this.findClosestDomain(emailParts.secondLevelDomain, secondLevelDomains, distanceFunction, this.secondLevelThreshold);
      if (closestSecondLevelDomain && closestSecondLevelDomain != emailParts.secondLevelDomain) {
        // The email address may have a mispelled second-level domain; return a suggestion
        closestDomain = closestDomain.replace(emailParts.secondLevelDomain, closestSecondLevelDomain);
        rtrn = true;
      }

      var closestTopLevelDomain = this.findClosestDomain(emailParts.topLevelDomain, topLevelDomains, distanceFunction, this.topLevelThreshold);
      if (closestTopLevelDomain && closestTopLevelDomain != emailParts.topLevelDomain) {
        // The email address may have a mispelled top-level domain; return a suggestion
        closestDomain = closestDomain.replace(emailParts.topLevelDomain, closestTopLevelDomain);
        rtrn = true;
      }

      if (emailParts.countryDomain) {
        var closestCountryDomain = this.findClosestDomain(emailParts.countryDomain, countryDomains, distanceFunction, 1);
        if (closestCountryDomain && closestCountryDomain != emailParts.countryDomain) {
          // The email address may have a mispelled country domain; return a suggestion
          closestDomain = closestDomain.replace(emailParts.countryDomain, closestCountryDomain);
          rtrn = true;
        }
      }

      if (rtrn) {
        return { address: emailParts.address, domain: closestDomain, full: emailParts.address + "@" + closestDomain };
      }
    }
    return false;
  },

  //deprecated, does nothing
  suggest: function(){},

  findClosestDomain: function(domain, domains, distanceFunction, threshold) {
    if (!domain || !domains) {
      return false;
    }

    threshold = threshold || this.topLevelThreshold;
    var dist,
      minDist = 99,
      closestDomain = null;

    if(!distanceFunction) {
      distanceFunction = this.sift3Distance;
    }

    for (var i = 0; i < domains.length; i++) {
      if (domain === domains[i]) {
        return domain;
      }
      dist = distanceFunction(domain, domains[i]);
      if (dist < minDist) {
        minDist = dist;
        closestDomain = domains[i];
      }
    }

    if (minDist <= threshold && closestDomain !== null) {
      return closestDomain;
    } else {
      return false;
    }
  },

  sift3Distance: function(s1, s2) {
    // sift3: http://siderite.blogspot.com/2007/04/super-fast-and-accurate-string-distance.html
    if (s1 === null || s1.length === 0) {
      if (s2 === null || s2.length === 0) {
        return 0;
      } else {
        return s2.length;
      }
    }

    if (s2 === null || s2.length === 0) {
      return s1.length;
    }

    var c = 0;
    var offset1 = 0;
    var offset2 = 0;
    var lcs = 0;
    var maxOffset = 5;

    while ((c + offset1 < s1.length) && (c + offset2 < s2.length)) {
      if (s1.charAt(c + offset1) == s2.charAt(c + offset2)) {
        lcs++;
      } else {
        offset1 = 0;
        offset2 = 0;
        for (var i = 0; i < maxOffset; i++) {
          if ((c + i < s1.length) && (s1.charAt(c + i) == s2.charAt(c))) {
            offset1 = i;
            break;
          }
          if ((c + i < s2.length) && (s1.charAt(c) == s2.charAt(c + i))) {
            offset2 = i;
            break;
          }
        }
      }
      c++;
    }
    return (s1.length + s2.length)/2 - lcs;
  },

  splitEmail: function(email) {
    var parts = email.trim().split('@'); //BUT not all browsers can trim()!

    if (parts.length < 2) {
      return false;
    }

    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === '') {
        return false;
      }
    }

    var domain = parts.pop(),
        domainParts = domain.split('.'),
        dpl = domainParts.length;
    if (dpl == 0) {
      // The address does not have a top-level domain
      return false;
    } else {
       var cd = false,
           tld = false,
           sld = false;
      if (dpl == 1) {
        // The address has only a top-level domain (valid under RFC)
        tld = domain;
      } else {
        // The address has a domain and/or a top-level domain and/or a country domain
        sld = domainParts.shift();
        if (dpl > 2) {
          cd = domainParts.pop();
        }
        tld = domainParts.join('.');
      }
    }

    return {
      countryDomain: cd,
      topLevelDomain: tld,
      secondLevelDomain: sld,
      domain: domain,
      address: parts.join('@')
    };
  },

  // Encode the email address to prevent XSS but leave in valid characters,
  // following this [un]official spec:
  // http://en.wikipedia.org/wiki/Email_address#Syntax
  encodeEmail: function(email) {
    var charmap = {
     _20:' ',
     _25:'%',
     _5E:'^',
     _60:'`',
     _7B:'{',
     _7C:'|',
     _7D:'}'
    },
    coded = encodeURI(email),
    result = coded.replace(/%(20|25|5E|60|7B|7C|7D)/g,function(){
      return charmap['_'+arguments[1]];
    });
    return result;
  },

  check: function(target,opts) {
    opts.email = target.value;
    var result = this.run(opts);
    if (result) {
      if (opts.suggested) {
        opts.suggested.call(this,target,result);
      }
    } else if (opts.empty) {
      if (opts.email.trim() === '') { //BUT not all browsers can trim()
        opts.empty.call(this,target);
      }
    }
  }
};

// Export the mailcheck object if we're in a CommonJS env (e.g. Node).
// Modeled off of Underscore.js.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Mailcheck;
}

// Support AMD style definitions
// Based on jQuery (see http://stackoverflow.com/a/17954882/1322410)
if (typeof define === "function" && define.amd) {
  define("mailcheck", [], function() {
    return Mailcheck;
  });
}

if (typeof window !== 'undefined' && window.jQuery) {
  (function($){
    $.fn.mailcheck = function(opts) {
      Mailcheck.check(this[0],opts);
      return this;
    };
  })(jQuery);
}
