// Copyright (C) 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Makes a makeFarResource function using a given
 * serializer/unserializer pair. A makeFarResource function makes a
 * farPromise for an (assumed remote) resource for a given URL.
 *
 * @author Mark S. Miller, but interim only until I examine how
 * ref_send/web_send (Tyler Close), qcomm (Kris Kowal), and BCap (Mark
 * Lentczner, Arjun Guha, Joe Politz) deal with similar issues.
 * //provides makeFarResourceMaker
 * @requires Q, cajaVM, this
 * @requires UniformRequest, AnonXMLHttpRequest, XMLHttpRequest
 */


(function(global) {
   "use strict";

   var bind = Function.prototype.bind;
   // See
   // http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
   var uncurryThis = bind.bind(bind.call);

   var applyFn = uncurryThis(bind.apply);
   var mapFn = uncurryThis([].map);

   var def;
   if (typeof cajaVM !== 'undefined') {
     def = cajaVM.def;
   } else {
     // Don't bother being properly defensive when run outside of Caja
     // or SES.
     def = Object.freeze;
   }

   var XHR;
   if (typeof UniformRequest !== 'undefined') {
     // Prefer UniformRequest
     XHR = UniformRequest;
   } else if (typeof AnonXMLHttpRequest !== 'undefined') {
     // AnonXMLHttpRequest is our next preference
     XHR = AnonXMLHttpRequest;
   } else {
     // If we can find a way to turn off the sending of credentials
     // for same-origin requests even in this case, we should.
     XHR = XMLHttpRequest;
   }

   /**
    * Makes a makeFarResource function using a given
    * serializer/unserializer pair. A makeFarResource function makes a
    * farPromise for an (assumed remote) resource for a given URL.
    *
    * <p>The optional serializer, if omitted, defaults to passing
    * through undefined and simple coercion of to string of everything
    * else. The optional unserializer defaults to passing back the
    * undefined or resultText that it is given. If both are omitted,
    * the resulting maker makes text resources, that provide access to
    * the text representation of the resource named at that url.
    */
   function makeFarResourceMaker(opt_serialize, opt_unserialize) {
     var serialize = opt_serialize || function(opt_input) {
       if (opt_input === void 0) { return void 0; }
       return '' + opt_input;
     };
     var unserialize = opt_unserialize || function(opt_resultText) {
       return opt_resultText;
     };

     /**
      * Makes a farPromise for an (assumed remote) resource for a given
      * URL.
      */
     function makeFarResource(url) {
       url = '' + url;

       var nextSlot = Q.defer();

       function farDispatch(OP, args) {
         var opt_name = args[0];
         var opt_entityBody = serialize(args[1]);
         var xhr = new XHR();
         if (opt_name !== void 0) {
           // SECURITY TODO(erights): Figure out what encoding is necessary
           url = url + '&q=' + encodeURIComponent(opt_name);
         }
         xhr.open(OP, url);

         var result = Q.defer();
         xhr.onreadystatechange = function() {
           if (this.readyState === 4) {
             if (this.status === 200) {
               result.resolve(unserialize(this.responseText));

          // } else if... { // What about other success statuses besides 200?
               // And do we deal with any redirects here, such as a
               // permanent redirect?

             } else if (this.status === 410) {
               var broken = Q.reject(new Error('Resource Gone'));
               nextSlot.resolve(def({value: broken}));
               result.resolve(broken);

             } else {
               // TODO(erights): better diagnostics. Include
               // responseText in Error?
               result.resolve(Q.reject(new Error('xhr ' + OP +
                                                 ' failed with status: ' +
                                                 this.status)));
             }
           }
         };
         if (opt_entityBody === void 0) {
           xhr.send();
         } else {
           xhr.send(opt_entityBody);
         }
         return result.promise;
       }

       return Q.makeFar(farDispatch, nextSlot.promise);
     }
     return def(makeFarResource);
   }
   global.makeFarResourceMaker = def(makeFarResourceMaker);

 })(this);