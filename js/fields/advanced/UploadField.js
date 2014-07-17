(function($) {

    var Alpaca = $.alpaca;

    Alpaca.Fields.UploadField = Alpaca.Fields.TextField.extend(
    /**
     * @lends Alpaca.Fields.UploadField.prototype
     */
    {
        /**
         * @constructs
         * @augments Alpaca.Fields.ObjectField
         *
         * @class Upload Field
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

            var self = this;

            this.base();

            this.controlFieldTemplateDescriptor = this.view.getTemplateDescriptor("controlFieldUpload");
            this.uploadDescriptor = self.view.getTemplateDescriptor("controlFieldUpload_upload");
            this.downloadDescriptor = self.view.getTemplateDescriptor("controlFieldUpload_download");

            if (typeof(self.options.multiple) == "undefined")
            {
                self.options.multiple = false;
            }

            if (typeof(self.options.showUploadPreview) == "undefined")
            {
                self.options.showUploadPreview = true;
            }

        },

        /**
         * @see Alpaca.ControlField#renderField
         */
        renderField: function(onSuccess) {

            var self = this;

            this.base(function() {

                self.field = $(self.field).find(".alpaca-fileupload-input-hidden");

                if (onSuccess) {
                    onSuccess();
                }

            });
        },


        /**
         * @see Alpaca.Fields.TextField#postRender
         */
        postRender: function(callback) {

            var self = this;

            this.base(function() {

                if (self.fieldContainer) {
                    self.fieldContainer.addClass('alpaca-controlfield-upload');
                }

                self.handlePostRender(self.fieldContainer, function() {
                    callback();
                });

            });
        },

        handlePostRender: function(el, callback)
        {
            var self = this;

            var uploadTemplateFunction = function(data)
            {
                return Alpaca.tmpl(self.uploadDescriptor, {
                    o: data
                });
            };
             var downloadTemplateFunction = function(data)
             {
                 return Alpaca.tmpl(self.downloadDescriptor, {
                     o: data
                 });
             };

            // file upload config
            var fileUploadConfig = {};

            // defaults
            fileUploadConfig["dataType"] = "json";
            fileUploadConfig["uploadTemplateId"] = null;
            fileUploadConfig["uploadTemplate"] = uploadTemplateFunction;
            fileUploadConfig["downloadTemplateId"] = null;
            fileUploadConfig["downloadTemplate"] = downloadTemplateFunction;
            fileUploadConfig["filesContainer"] = $(el).find(".files");
            fileUploadConfig["dropZone"] = $(el).find(".fileupload-active-zone");
            fileUploadConfig["url"] = "/";
            fileUploadConfig["method"] = "post";
            fileUploadConfig["showUploadPreview"] = self.options.showUploadPreview;

            if (self.options.upload)
            {
                for (var k in self.options.upload)
                {
                    fileUploadConfig[k] = self.options.upload[k];
                }
            }

            if (self.options.multiple)
            {
                $(el).find(".alpaca-fileupload-input").attr("multiple", true);
                $(el).find(".alpaca-fileupload-input").attr("name", self.name + "_files[]");
            }

            // hide the progress bar at first
            $(el).find(".progress").css("display", "none");

            /**
             * If a file is being uploaded, show the progress bar.  Otherwise, hide it.
             *
             * @param e
             * @param data
             */
            fileUploadConfig["progressall"] = function (e, data) {

                var showProgressBar = false;
                if (data.loaded < data.total)
                {
                    showProgressBar = true;
                }
                if (showProgressBar)
                {
                    $(el).find(".progress").css("display", "block");
                    var progress = parseInt(data.loaded / data.total * 100, 10);
                    $('#progress .progress-bar').css(
                        'width',
                        progress + '%'
                    );
                }
                else
                {
                    $(el).find(".progress").css("display", "none");
                }
            };

            // allow for extension
            self.applyConfiguration(fileUploadConfig);

            // instantiate the control
            var fileUpload = self.fileUpload = $(el).find('.alpaca-fileupload-input').fileupload(fileUploadConfig);

            // When file upload of a file competes, we offer the chance to adjust the data ahead of FileUpload
            // getting it.  This is useful for cases where you can't change the server side JSON but could do
            // a little bit of magic in the client.
            fileUpload.bindFirst("fileuploaddone", function(e, data) {

                var enhanceFiles = self.options.enhanceFiles;
                if (enhanceFiles)
                {
                    enhanceFiles(fileUploadConfig, data);
                }
                else
                {
                    self.enhanceFiles(fileUploadConfig, data);
                }

                // copy back down into data.files
                data.files = data.result.files;
            });

            // When files are submitted, the "properties" and "parameters" options map are especially treated
            // and are written into property<index>__<key> and param<index>__key entries in the form data.
            // This allows for multi-part receivers to get values on a per-file basis.
            // Plans are to allow token substitution and other client-side treatment ahead of posting.
            fileUpload.bindFirst("fileuploadsubmit", function(e, data) {

                if (self.options["properties"])
                {
                    $.each(data.files, function(index, file) {

                        for (var key in self.options["properties"])
                        {
                            var propertyName = "property" + index + "__" + key;
                            var propertyValue = self.options["properties"][key];

                            // token substitutions
                            propertyValue = self.applyTokenSubstitutions(propertyValue, index, file);

                            if (!data.formData) {
                                data.formData = {};
                            }

                            data.formData[propertyName] = propertyValue;
                        }
                    });
                }

                if (self.options["parameters"])
                {
                    $.each(data.files, function(index, file) {

                        for (var key in self.options["parameters"])
                        {
                            var paramName = "param" + index + "__" + key;
                            var paramValue = self.options["parameters"][key];

                            // token substitutions
                            paramValue = self.applyTokenSubstitutions(paramValue, index, file);

                            if (!data.formData) {
                                data.formData = {};
                            }

                            data.formData[paramName] = paramValue;
                        }
                    });
                }
            });

            /**
             * When files are uploaded, we adjust the value of the field.
             */
            fileUpload.bind("fileuploaddone", function(e, data) {

                // existing
                var array = self.getValue();

                var f = function(i)
                {
                    if (i == data.files.length)
                    {
                        // done
                        self.setValue(array);
                        return;
                    }

                    self.convertFileToDescriptor(data.files[i], function(err, descriptor) {
                        if (descriptor)
                        {
                            array.push(descriptor);
                        }
                        f(i+1);
                    });
                };
                f(0);
            });

            // allow for extension
            self.applyBindings(fileUpload, el);

            // allow for preloading of documents
            self.preload(fileUpload, el, function(files) {

                if (files)
                {
                    var form = $(self.fieldContainer).find('.alpaca-fileupload-input');
                    $(form).fileupload('option', 'done').call(form, $.Event('done'), {
                        result: {
                            files: files
                        }
                    });

                    self.afterPreload(fileUpload, el, files, function() {
                        callback();
                    });
                }
                else
                {
                    callback();
                }
            });
        },

        applyTokenSubstitutions: function(text, index, file)
        {
            var tokens = {
                "index": index,
                "name": file.name,
                "size": file.size,
                "url": file.url,
                "thumbnailUrl": file.thumbnailUrl
            };

            // substitute any tokens
            var x = -1;
            var b = 0;
            do
            {
                x = text.indexOf("{", b);
                if (x > -1)
                {
                    var y = text.indexOf("}", x);
                    if (y > -1)
                    {
                        var token = text.substring(x + car.length, y);

                        var replacement = tokens[token];
                        if (replacement)
                        {
                            text = text.substring(0, x) + replacement + text.substring(y+1);
                        }

                        b = y + 1;
                    }
                }
            }
            while(x > -1);

            return text;
        },

        /**
         * Removes a descriptor with the given id from the value set.
         *
         * @param id
         */
        removeValue: function(id)
        {
            var self = this;

            var array = self.getValue();
            for (var i = 0; i < array.length; i++)
            {
                if (array[i].id == id)
                {
                    array.splice(i, 1);
                    break;
                }
            }

            self.setValue(array);
        },


        /**
         * Extension point for adding properties and callbacks to the file upload config.
         *
         * @param fileUploadconfig
         */
        applyConfiguration: function(fileUploadconfig)
        {
        },

        /**
         * Extension point for binding event handlers to file upload instance.
         *
         * @param fileUpload
         */
        applyBindings: function(fileUpload)
        {
        },

        /**
         * Converts from a file to a storage descriptor.
         *
         * A descriptor looks like:
         *
         *      {
         *          "id": ""
         *          ...
         *      }
         *
         * A descriptor may contain additional properties as needed by the underlying storage implementation
         * so as to retrieve metadata about the described file.
         *
         * Assumption is that the underlying persistence mechanism may need to be consulted.  Thus, this is async.
         *
         * By default, the descriptor mimics the file.
         *
         * @param file
         * @param callback function(err, descriptor)
         */
        convertFileToDescriptor: function(file, callback)
        {
            var descriptor = {
                "id": file.id,
                "name": file.name,
                "size": file.size,
                "url": file.url,
                "thumbnailUrl":file.thumbnailUrl,
                "deleteUrl": file.deleteUrl,
                "deleteType": file.deleteType
            };

            callback(null, descriptor);
        },

        /**
         * Converts a storage descriptor to a file.
         *
         * A file looks like:
         *
         *      {
         *          "id": "",
         *          "name": "picture1.jpg",
         *          "size": 902604,
         *          "url": "http:\/\/example.org\/files\/picture1.jpg",
         *          "thumbnailUrl": "http:\/\/example.org\/files\/thumbnail\/picture1.jpg",
         *          "deleteUrl": "http:\/\/example.org\/files\/picture1.jpg",
         *          "deleteType": "DELETE"
         *      }
         *
         * Since an underlying storage mechanism may be consulted, an async callback hook is provided.
         *
         * By default, the descriptor mimics the file.
         *
         * @param descriptor
         * @param callback function(err, file)
         */
        convertDescriptorToFile: function(descriptor, callback)
        {
            var file = {
                "id": descriptor.id,
                "name": descriptor.name,
                "size": descriptor.size,
                "url": descriptor.url,
                "thumbnailUrl":descriptor.thumbnailUrl,
                "deleteUrl": descriptor.deleteUrl,
                "deleteType": descriptor.deleteType
            };

            callback(null, file);
        },

        /**
         * Extension point for "enhancing" data received from the remote server after uploads have been submitted.
         * This provides a place to convert the data.rows back into the format which the upload control expects.
         *
         * Expected format:
         *
         *    data.result.rows = [{...}]
         *    data.result.files = [{
         *      "id": "",
         *      "path": "",
         *      "name": "picture1.jpg",
         *      "size": 902604,
         *      "url": "http:\/\/example.org\/files\/picture1.jpg",
         *      "thumbnailUrl": "http:\/\/example.org\/files\/thumbnail\/picture1.jpg",
         *      "deleteUrl": "http:\/\/example.org\/files\/picture1.jpg",
         *      "deleteType": "DELETE"*
         *    }]
         *
         * @param fileUploadConfig
         * @param row
         */
        enhanceFiles: function(fileUploadConfig, data)
        {
        },

        /**
         * Preloads data descriptors into files.
         *
         * @param fileUpload
         * @param el
         * @param callback
         */
        preload: function(fileUpload, el, callback)
        {
            var self = this;

            var files = [];

            // now preload with files based on property value
            var descriptors = self.getValue();

            var f = function(i)
            {
                if (i == descriptors.length)
                {
                    // all done
                    callback(files);
                    return;
                }

                self.convertDescriptorToFile(descriptors[i], function(err, file) {
                    if (file)
                    {
                        files.push(file);
                    }
                    f(i+1);
                });
            };
            f(0);
        },

        afterPreload: function(fileUpload, el, files, callback)
        {
            callback();
        },

        /**
         * @override
         *
         * Retrieves an array of descriptors.
         */
        getValue: function()
        {
            if (!this.data)
            {
                this.data = [];
            }

            return this.data;
        },

        /**
         * @override
         *
         * Sets an array of descriptors.
         *
         * @param data
         */
        setValue: function(data)
        {
            this.data = data;
        },

        reload: function(callback)
        {
            var self = this;

            var descriptors = this.getValue();

            var files = [];

            var f = function(i)
            {
                if (i == descriptors.length)
                {
                    // all done

                    var form = $(self.fieldContainer).find('.alpaca-fileupload-input');
                    $(form).fileupload('option', 'done').call(form, $.Event('done'), {
                        result: {
                            files: files
                        }
                    });

                    callback();

                    return;
                }

                self.convertDescriptorToFile(descriptors[i], function(err, file) {
                    if (file)
                    {
                        files.push(file);
                    }
                    f(i+1);
                });
            };
            f(0);
        },
        //__BUILDER_HELPERS

        /**
         * @see Alpaca.ControlField#getTitle
         */
        getTitle: function() {
            return "Upload Field";
        },

        /**
         * @see Alpaca.ControlField#getDescription
         */
        getDescription: function() {
            return "Provides an upload field with support for thumbnail preview";
        },

        /**
         * @see Alpaca.ControlField#getType
         */
        getType: function() {
            return "array";
        },

        /**
         * @see Alpaca.ControlField#getFieldType
         */
        getFieldType: function() {
            return "upload";
        }//__END_OF_BUILDER_HELPERS
    });

    var TEMPLATE = ' \
        <div class="alpaca-fileupload-container {{if cssClasses}}${cssClasses}{{/if}}"> \
            <div class="container-fluid"> \
                <div class="row"> \
                    <div class="col-md-12"> \
                        <div class="btn-group"> \
                            <button class="btn btn-default fileinput-button"> \
                                <i class="glyphicon glyphicon-upload"></i> \
                                <span class="fileupload-add-button">Choose files...</span> \
                                <input class="alpaca-fileupload-input" type="file" name="${name}_files"> \
                                <input class="alpaca-fileupload-input-hidden" type="hidden" name="${name}_files_hidden"> \
                            </button> \
                        </div> \
                    </div> \
                </div> \
                <div class="row alpaca-fileupload-well"> \
                    <div class="col-md-12 fileupload-active-zone"> \
                        <table class="table table-striped"> \
                            <tbody class="files"> \
                            </tbody> \
                        </table> \
                        <p align="center">Click the Choose button or Drag and Drop files here to start...</p> \
                    </div> \
                </div> \
                <div class="row"> \
                    <div class="col-md-12"> \
                        <div id="progress" class="progress"> \
                            <div class="progress-bar progress-bar-success"></div> \
                        </div> \
                    </div> \
                </div> \
            </div> \
        </div> \
    ';

    var TEMPLATE_UPLOAD = ' \
        <script id="template-upload" type="text/x-tmpl"> \
        {{each(i, file) o.files}} \
            <tr class="template-upload fade"> \
                {{if o.options.showUploadPreview}} \
                <td class="preview"> \
                    <span class="fade"></span> \
                </td> \
                {{else}} \
                <td> \
                </td> \
                {{/if}} \
                <td class="name"><span>${file.name}</span></td> \
                <td class="size"><span>${file.size}</span></td> \
            {{if file.error}} \
                <td class="error" colspan="2"><span class="label label-important">Error</span> ${file.error}</td> \
            {{else}} \
                {{if o.files.valid && !i}} \
                <td> \
                    <div class="progress progress-success progress-striped active" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"> \
                        <div class="progress-bar" style="width:0%;"></div>\
                    </div> \
                </td> \
                <td class="start">\
                {{if !o.options.autoUpload}} \
                    <button class="btn btn-primary"> \
                        <i class="glyphicon glyphicon-upload glyphicon-white"></i> \
                        <span>Start</span> \
                    </button> \
                {{/if}} \
                </td> \
                {{else}} \
                <td colspan="2"></td> \
                <td class="cancel">\
                {{if !i}} \
                    <button class="btn btn-warning"> \
                        <i class="glyphicon glyphicon-ban-circle glyphicon-white"></i> \
                        <span>Cancel</span> \
                    </button> \
                {{/if}} \
                </td> \
                {{/if}} \
            {{/if}} \
                <td></td> \
            </tr> \
        {{/each}} \
        </script> \
    ';

    var TEMPLATE_DOWNLOAD = ' \
        <script id="template-download" type="text/x-tmpl"> \
        {{each(i, file) o.files}} \
            <tr class="template-download fade"> \
            {{if file.error}} \
                <td></td> \
                <td class="name"><span>${file.name}</span></td> \
                <td class="size"><span>${file.size}</span></td> \
                <td class="error" colspan="2"><span class="label label-important">Error</span> ${file.error}</td> \
            {{else}} \
                <td class="preview"> \
                {{if file.thumbnailUrl}} \
                    <a href="${file.url}" title="${file.name}" data-gallery="gallery" download="${file.name}"> \
                        <img src="${file.thumbnailUrl}"> \
                    </a> \
                {{/if}} \
                </td> \
                <td class="name"> \
                    <a href="${file.url}" title="${file.name}" data-gallery="${file.thumbnailUrl}gallery" download="${file.name}">${file.name}</a> \
                </td> \
                <td class="size"><span>${file.size}</span></td> \
                <td colspan="2"></td> \
            {{/if}} \
                <td> \
                    <button class="delete btn btn-danger" data-type="${file.deleteType}" data-url="${file.deleteUrl}" {{if file.deleteWithCredentials}}data-xhr-fields="{\"withCredentials\":true}" {{/if}}> \
                        <i class="glyphicon glyphicon-trash glyphicon-white"></i> \
                        <span>Delete</span> \
                    </button> \
                </td> \
            </tr> \
        {{/each}} \
        </script> \
    ';

    Alpaca.registerTemplate("controlFieldUpload", TEMPLATE);
    Alpaca.registerTemplate("controlFieldUpload_upload", TEMPLATE_UPLOAD);
    Alpaca.registerTemplate("controlFieldUpload_download", TEMPLATE_DOWNLOAD);
    Alpaca.registerFieldClass("upload", Alpaca.Fields.UploadField);

    // https://github.com/private-face/jquery.bind-first/blob/master/dev/jquery.bind-first.js
    // jquery.bind-first.js
    (function($) {
        var splitVersion = $.fn.jquery.split(".");
        var major = parseInt(splitVersion[0]);
        var minor = parseInt(splitVersion[1]);

        var JQ_LT_17 = (major < 1) || (major == 1 && minor < 7);

        function eventsData($el)
        {
            return JQ_LT_17 ? $el.data('events') : $._data($el[0]).events;
        }

        function moveHandlerToTop($el, eventName, isDelegated)
        {
            var data = eventsData($el);
            var events = data[eventName];

            if (!JQ_LT_17) {
                var handler = isDelegated ? events.splice(events.delegateCount - 1, 1)[0] : events.pop();
                events.splice(isDelegated ? 0 : (events.delegateCount || 0), 0, handler);

                return;
            }

            if (isDelegated) {
                data.live.unshift(data.live.pop());
            } else {
                events.unshift(events.pop());
            }
        }

        function moveEventHandlers($elems, eventsString, isDelegate) {
            var events = eventsString.split(/\s+/);
            $elems.each(function() {
                for (var i = 0; i < events.length; ++i) {
                    var pureEventName = $.trim(events[i]).match(/[^\.]+/i)[0];
                    moveHandlerToTop($(this), pureEventName, isDelegate);
                }
            });
        }

        $.fn.bindFirst = function()
        {
            var args = $.makeArray(arguments);
            var eventsString = args.shift();

            if (eventsString) {
                $.fn.bind.apply(this, arguments);
                moveEventHandlers(this, eventsString);
            }

            return this;
        };

    })($);

})(jQuery);
