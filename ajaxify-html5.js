// Ajaxify
// v1.0.1 - 30 September, 2012
// https://github.com/browserstate/ajaxify
var ajaxifySite = window.ajaxifySite || {};
ajaxifySite.init = function(options){
	
	// Prepare our Variables
	var
		History = window.History,
		$ = window.jQuery,
		document = window.document;

	// Check to see if History.js is enabled for our Browser
	if ( !History.enabled ) {
		return false;
	}

	// Wait for Document
	$(function(){
		// Prepare Variables
		var
			/* Application Specific Variables */
            settings = $.extend({ 
                contentSelector: '#content,article:first,.article:first,.post:first',
                menuSelector: '#menu,#nav,nav:first,.nav:first',
                activeClass: 'active selected current youarehere',
                activeSelector: '.active,.selected,.current,.youarehere',
                menuChildrenSelector: '> li,> ul > li',
                completedEventName: 'statechangecomplete',
                scrollOptions: {
                    duration: 800,
                    easing: 'swing'
                },
                ignoreSelector: '.no-ajaxy',
                ignoreScripts: false
            }, options), 
            // TODO get rid of these and just replace variables with settings object reference
			contentSelector = settings.contentSelector,
			$content = $(contentSelector).filter(':first'),
			contentNode = $content.get(0),
            menuSelector = settings.menuSelector,
			$menu = $(menuSelector).filter(':first'),
			activeClass = settings.activeClass,
			activeSelector =  settings.activeSelector,
			menuChildrenSelector = settings.menuChildrenSelector,
			completedEventName =  settings.completedEventName,
			/* Application Generic Variables */
			$window = $(window),
			$body = $(document.body),
			rootUrl = History.getRootUrl(),
			scrollOptions = settings.scrollOptions; 
		
		// Ensure Content
		if ( $content.length === 0 ) {
			$content = $body;
		}
		
		// Internal Helper
		$.expr[':'].internal = function(obj, index, meta, stack){
			// Prepare
			var
				$this = $(obj),
				url = $this.attr('href')||'',
				isInternalLink;
			
			// Check link
			isInternalLink = url.substring(0,rootUrl.length) === rootUrl || url.indexOf(':') === -1;
			
			// Ignore or Keep
			return isInternalLink;
		};
		
		// HTML Helper
		var documentHtml = function(html){
			// Prepare
			var result = String(html)
				.replace(/<\!DOCTYPE[^>]*>/i, '')
				.replace(/<(html|head|body|title|meta|script)([\s\>])/gi,'<div class="document-$1"$2')
				.replace(/<\/(html|head|body|title|meta|script)\>/gi,'</div>')
			;
			
			// Return
			return $.trim(result);
		};
		
		// Ajaxify Helper
		$.fn.ajaxify = function(){
			// Prepare
			var $this = $(this);
			
			// Ajaxify
			$this.find('a:internal:not(' + settings.ignoreSelector + ')').click(function(event){
				// Prepare
				var
					$this = $(this),
					url = $this.attr('href'),
					title = $this.attr('title')||null;
				
				// Continue as normal for cmd clicks etc
				if ( event.which == 2 || event.metaKey ) { return true; }
				
				// Ajaxify this link
				History.pushState(null,title,url);
				event.preventDefault();
				return false;
			});
			
			// Chain
			return $this;
		};
		
		// Ajaxify our Internal Links
		$body.ajaxify();
		
		// Hook into State Changes
		History.Adapter.bind(window, 'statechange', function(){
			// Prepare Variables
			var
				State = History.getState(),
				url = State.url,
				relativeUrl = url.replace(rootUrl,'');

			// Set Loading
			$body.addClass('loading');

			// Start Fade Out
			// Animating to opacity to 0 still keeps the element's height intact
			// Which prevents that annoying pop bang issue when loading in new content
			$content.animate({opacity:0},800);
			
			// Ajax Request the Traditional Page
			$.ajax({
				url: url,
				success: function(data, textStatus, jqXHR){
					// Prepare
					var
						$data = $(documentHtml(data)),
						$dataBody = $data.find('.document-body:first'),
						$dataContent = $dataBody.find(contentSelector).filter(':first'),
						$menuChildren, contentHtml, $scripts;
					
					// Fetch the scripts
					$scripts = $dataContent.find('.document-script');
					if ( $scripts.length ) {
						$scripts.detach();
					}

					// Fetch the content
					contentHtml = $dataContent.html()||$data.html();
					if ( !contentHtml ) {
						document.location.href = url;
						return false;
					}
					
					// Update the menu
					$menuChildren = $menu.find(menuChildrenSelector);
					$menuChildren.filter(activeSelector).removeClass(activeClass);
					$menuChildren = $menuChildren.has('a[href^="'+relativeUrl+'"],a[href^="/'+relativeUrl+'"],a[href^="'+url+'"]');
					if ( $menuChildren.length === 1 ) { $menuChildren.addClass(activeClass); }

					// Update the content
					$content.stop(true,true);
					$content.html(contentHtml).ajaxify();
                    if (window.imagesLoaded) {
                        $content.imagesLoaded().done(function(){ $content.animate({opacity: 1}, 800); }); /* you could fade in here if you'd like */
                    } else if(window.waitForImages) {
                        $content.waitForImages().done(function(){ $content.animate({opacity: 1}, 800); }); /* you could fade in here if you'd like */
                    } else {
                        $content.animate({opacity: 1}, 800);
                    }
					// Update the title
					document.title = $data.find('.document-title:first').text();
					try {
						document.getElementsByTagName('title')[0].innerHTML = document.title.replace('<','&lt;').replace('>','&gt;').replace(' & ',' &amp; ');
					}
					catch ( Exception ) { }
					
					// Add the scripts
                    if (!settings.ignoreScripts) {
                        $scripts.each(function(){
                            var $script = $(this), scriptText = $script.text(), scriptNode = document.createElement('script');
                            if ( $script.attr('src') ) {
                                if ( !$script[0].async ) { scriptNode.async = false; }
                                scriptNode.src = $script.attr('src');
                            }
                                scriptNode.appendChild(document.createTextNode(scriptText));
                            contentNode.appendChild(scriptNode);
                        });
                    }

					// Complete the change
					if ( $body.ScrollTo||false ) { $body.ScrollTo(scrollOptions); } /* http://balupton.com/projects/jquery-scrollto */
					$body.removeClass('loading');
					$window.trigger(completedEventName);
	
					// Inform Google Analytics of the change
					if ( typeof window._gaq !== 'undefined' ) {
						window._gaq.push(['_trackPageview', relativeUrl]);
					}

					// Inform ReInvigorate of a state change
					if ( typeof window.reinvigorate !== 'undefined' && typeof window.reinvigorate.ajax_track !== 'undefined' ) {
						reinvigorate.ajax_track(url);
						// ^ we use the full url here as that is what reinvigorate supports
					}
				},
				error: function(jqXHR, textStatus, errorThrown){
					document.location.href = url;
					return false;
				}
			}); // end ajax

		}); // end onStateChange

	}); // end onDomLoad

}; // end closure
