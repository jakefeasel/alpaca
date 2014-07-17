(function($) {

    var Alpaca = $.alpaca;

    Alpaca.Fields.EditorField = Alpaca.Fields.TextField.extend(
        /**
         * @lends Alpaca.Fields.EditorField.prototype
         */
        {
            /**
             * @constructs
             * @augments Alpaca.Fields.TextField
             *
             * @class Textarea control for chunk of text.
             *
             * @param {Object} container Field container.
             * @param {Any} data Field data.
             * @param {Object} options Field options.
             * @param {Object} schema Field schema.
             * @param {Object|String} view Field view.
             * @param {Alpaca.Connector} connector Field connector.
             * @param {Function} errorCallback Error callback.
             */
            constructor: function(container, data, options, schema, view, connector, errorCallback) {
                this.base(container, data, options, schema, view, connector, errorCallback);
            },

            /**
             * @see Alpaca.Fields.TextField#setup
             */
            setup: function() {
                this.base();

                this.controlFieldTemplateDescriptor = this.view.getTemplateDescriptor("controlFieldEditor");
            },

            /**
             * @see Alpaca.Fields.TextField#postRender
             */
            postRender: function(callback) {

                var self = this;

                this.base(function() {

                    if (self.fieldContainer)
                    {
                        self.fieldContainer.addClass('alpaca-controlfield-editor');

                        // set field container parent width = 100%
                        $(self.fieldContainer).parent().css("width", "100%");

                        // ACE HEIGHT
                        var aceHeight = self.options.aceHeight;
                        if (aceHeight)
                        {
                            $(self.fieldContainer).css("height", aceHeight);
                        }

                        // ACE WIDTH
                        var aceWidth = self.options.aceWidth;
                        if (!aceWidth) {
                            aceWidth = "100%";
                        }
                        $(self.fieldContainer).css("width", aceWidth);
                    }

                    // locate where we will insert the editor
                    var el = $(self.fieldContainer).find(".control-field-editor-el")[0];

                    // ace must be included ahead of time
                    if (!ace && window.ace) {
                        ace = window.ace;
                    }

                    if (!ace)
                    {
                        Alpaca.logError("Editor Field is missing the 'ace' Cloud 9 Editor");
                    }
                    else
                    {
                        self.editor = ace.edit(el);

                        // theme
                        var aceTheme = self.options.aceTheme;
                        if (!aceTheme) {
                            aceTheme = "ace/theme/chrome";
                        }
                        self.editor.setTheme(aceTheme);

                        // mode
                        var aceMode = self.options.aceMode;
                        if (!aceMode) {
                            aceMode = "ace/mode/json";
                        }
                        self.editor.getSession().setMode(aceMode);

                        self.editor.renderer.setHScrollBarAlwaysVisible(false);
                        //this.editor.renderer.setVScrollBarAlwaysVisible(false); // not implemented
                        self.editor.setShowPrintMargin(false);

                        // set data onto editor
                        self.editor.setValue(self.data);
                        self.editor.clearSelection();

                        // clear undo session
                        self.editor.getSession().getUndoManager().reset();

                        // FIT-CONTENT the height of the editor to the contents contained within
                        if (self.options.aceFitContentHeight)
                        {
                            var heightUpdateFunction = function() {

                                var first = false;
                                if (self.editor.renderer.lineHeight === 1)
                                {
                                    first = true;
                                    self.editor.renderer.lineHeight = 16;
                                }

                                // http://stackoverflow.com/questions/11584061/
                                var newHeight = self.editor.getSession().getScreenLength() * self.editor.renderer.lineHeight + self.editor.renderer.scrollBar.getWidth();

                                $(self.fieldContainer).height(newHeight.toString() + "px");

                                // This call is required for the editor to fix all of
                                // its inner structure for adapting to a change in size
                                self.editor.resize();

                                if (first)
                                {
                                    window.setTimeout(function() {
                                        self.editor.clearSelection();
                                    }, 5);
                                }
                            };

                            // Set initial size to match initial content
                            heightUpdateFunction();

                            // Whenever a change happens inside the ACE editor, update
                            // the size again
                            self.editor.getSession().on('change', heightUpdateFunction);
                        }

                        // READONLY
                        if (self.schema.readonly)
                        {
                            self.editor.setReadOnly(true);
                        }

                        // if the editor's dom element gets destroyed, make sure we clean up the editor instance
                        // normally, we expect Alpaca fields to be destroyed by the destroy() method but they may also be
                        // cleaned-up via the DOM, thus we check here.
                        $(el).bind('destroyed', function() {

                            if (self.editor) {
                                self.editor.destroy();
                                self.editor = null;
                            }
                        });
                    }

                    callback();
                });

            },

            /**
             * @see Alpaca.Field#destroy
             */
            destroy: function() {

                // destroy the editor instance
                if (this.editor)
                {
                    this.editor.destroy();
                    this.editor = null;
                }

                // call up to base method
                this.base();
            },

            /**
             * @return the ACE editor instance
             */
            getEditor: function()
            {
                return this.editor;
            },

            /**
             * @see Alpaca.ControlField#handleValidate
             */
            handleValidate: function() {
                var baseStatus = this.base();

                var valInfo = this.validation;

                var wordCountStatus =  this._validateWordCount();
                valInfo["wordLimitExceeded"] = {
                    "message": wordCountStatus ? "" : Alpaca.substituteTokens(this.view.getMessage("wordLimitExceeded"), [this.options.wordlimit]),
                    "status": wordCountStatus
                };

                var editorAnnotationsStatus = this._validateEditorAnnotations();
                valInfo["editorAnnotationsExist"] = {
                    "message": editorAnnotationsStatus ? "" : this.view.getMessage("editorAnnotationsExist"),
                    "status": editorAnnotationsStatus
                };

                return baseStatus && valInfo["wordLimitExceeded"]["status"] && valInfo["editorAnnotationsExist"]["status"];
            },

            _validateEditorAnnotations: function() {

                if (this.editor)
                {
                    var annotations = this.editor.getSession().getAnnotations();
                    if (annotations && annotations.length > 0)
                    {
                        return false;
                    }
                }

                return true;
            },

            /**
             * Validate for word limit.
             *
             * @returns {Boolean} True if the number of words is equal to or less than the word limit.
             */
            _validateWordCount: function() {

                if (this.options.wordlimit && this.options.wordlimit > -1)
                {
                    var val = this.editor.getValue();

                    if (val)
                    {
                        var wordcount = val.split(" ").length;
                        if (wordcount > this.options.wordlimit)
                        {
                            return false;
                        }
                    }
                }

                return true;
            },

            /**
             * Force editor to resize to ensure it gets drawn correctly.
             * @override
             */
            onDependentReveal: function()
            {
                if (this.editor)
                {
                    this.editor.resize();
                }
            },

            /**
             *@see Alpaca.Fields.TextField#setValue
             */
            setValue: function(value) {

                var self = this;

                if (this.editor)
                {
                    this.editor.setValue(value);
                }

                // be sure to call into base method
                this.base(value);
            },

            /**
             * @see Alpaca.Fields.TextField#getValue
             */
            getValue: function() {

                var value = null;

                if (this.editor)
                {
                    value = this.editor.getValue();
                }

                return value;
            },//__BUILDER_HELPERS

            /**
             * @private
             * @see Alpaca.Fields.TextField#getSchemaOfOptions
             */
            getSchemaOfOptions: function() {
                return Alpaca.merge(this.base(), {
                    "properties": {
                        "aceTheme": {
                            "title": "ACE Editor Theme",
                            "description": "Specifies the theme to set onto the editor instance",
                            "type": "string",
                            "default": "ace/theme/twilight"
                        },
                        "aceMode": {
                            "title": "ACE Editor Mode",
                            "description": "Specifies the mode to set onto the editor instance",
                            "type": "string",
                            "default": "ace/mode/javascript"
                        },
                        "aceWidth": {
                            "title": "ACE Editor Height",
                            "description": "Specifies the width of the wrapping div around the editor",
                            "type": "string",
                            "default": "100%"
                        },
                        "aceHeight": {
                            "title": "ACE Editor Height",
                            "description": "Specifies the height of the wrapping div around the editor",
                            "type": "string",
                            "default": "300px"
                        },
                        "aceFitContentHeight": {
                            "title": "ACE Fit Content Height",
                            "description": "Configures the ACE Editor to auto-fit its height to the contents of the editor",
                            "type": "boolean",
                            "default": false
                        },
                        "wordlimit": {
                            "title": "Word Limit",
                            "description": "Limits the number of words allowed in the text area.",
                            "type": "number",
                            "default": -1
                        }
                    }
                });
            },

            /**
             * @private
             * @see Alpaca.Fields.TextField#getOptionsForOptions
             */
            getOptionsForOptions: function() {
                return Alpaca.merge(this.base(), {
                    "fields": {
                        "aceTheme": {
                            "type": "text"
                        },
                        "aceMode": {
                            "type": "text"
                        },
                        "wordlimit": {
                            "type": "integer"
                        }
                    }
                });
            },

            /**
             * @see Alpaca.Fields.TextField#getTitle
             */
            getTitle: function() {
                return "Editor";
            },

            /**
             * @see Alpaca.Fields.TextField#getDescription
             */
            getDescription: function() {
                return "Editor";
            },

            /**
             * @see Alpaca.Fields.TextField#getFieldType
             */
            getFieldType: function() {
                return "editor";
            }//__END_OF_BUILDER_HELPERS

        });

    Alpaca.registerMessages({
        "wordLimitExceeded": "The maximum word limit of {0} has been exceeded.",
        "editorAnnotationsExist": "The editor has errors in it that must be corrected"
    });

    Alpaca.registerTemplate("controlFieldEditor", '<div id="${id}" class="control-field-editor-el"></div>');
    Alpaca.registerFieldClass("editor", Alpaca.Fields.EditorField);

})(jQuery);
