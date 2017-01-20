'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _ = require('underscore');
var AVRequest = require('./request').request;

module.exports = function (AV) {
  var getUser = function getUser() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    return AV.User.currentAsync().then(function (currUser) {
      return currUser || AV.User._fetchUserBySessionToken(options.sessionToken);
    });
  };

  var getUserPointer = function getUserPointer(options) {
    return getUser(options).then(function (currUser) {
      return AV.Object.createWithoutData('_User', currUser.id)._toPointer();
    });
  };

  /**
   * Contains functions to deal with Status in LeanCloud.
   * @class
   */
  AV.Status = function (imageUrl, message) {
    this.data = {};
    this.inboxType = 'default';
    this.query = null;
    if (imageUrl && (typeof imageUrl === 'undefined' ? 'undefined' : _typeof(imageUrl)) === 'object') {
      this.data = imageUrl;
    } else {
      if (imageUrl) {
        this.data.image = imageUrl;
      }
      if (message) {
        this.data.message = message;
      }
    }
    return this;
  };

  AV.Status.prototype = {
    /**
     * Gets the value of an attribute in status data.
     * @param {String} attr The string name of an attribute.
     */
    get: function get(attr) {
      return this.data[attr];
    },
    /**
     * Sets a hash of model attributes on the status data.
     * @param {String} key The key to set.
     * @param {} value The value to give it.
     */
    set: function set(key, value) {
      this.data[key] = value;
      return this;
    },
    /**
     * Destroy this status,then it will not be avaiable in other user's inboxes.
     * @param {AuthOptions} options
     * @return {Promise} A promise that is fulfilled when the destroy
     *     completes.
     */
    destroy: function destroy(options) {
      if (!this.id) return AV.Promise.reject(new Error('The status id is not exists.'));
      var request = AVRequest('statuses', null, this.id, 'DELETE', options);
      return request;
    },
    /**
      * Cast the AV.Status object to an AV.Object pointer.
      * @return {AV.Object} A AV.Object pointer.
      */
    toObject: function toObject() {
      if (!this.id) return null;
      return AV.Object.createWithoutData('_Status', this.id);
    },
    _getDataJSON: function _getDataJSON() {
      var json = _.clone(this.data);
      return AV._encode(json);
    },
    /**
     * Send a status by a AV.Query object.
     * @since 0.3.0
     * @param {AuthOptions} options
     * @return {Promise} A promise that is fulfilled when the send
     *     completes.
     * @example
     *     // send a status to male users
     *     var status = new AVStatus('image url', 'a message');
     *     status.query = new AV.Query('_User');
     *     status.query.equalTo('gender', 'male');
     *     status.send().then(function(){
     *              //send status successfully.
     *      }, function(err){
     *             //an error threw.
     *             console.dir(err);
     *      });
     */
    send: function send() {
      var _this = this;

      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      if (!options.sessionToken && !AV.User.current()) {
        throw new Error('Please signin an user.');
      }
      if (!this.query) {
        return AV.Status.sendStatusToFollowers(this, options);
      }

      return getUserPointer(options).then(function (currUser) {
        var query = _this.query.toJSON();
        query.className = _this.query.className;
        var data = {};
        data.query = query;
        _this.data = _this.data || {};
        _this.data.source = _this.data.source || currUser;
        data.data = _this._getDataJSON();
        data.inboxType = _this.inboxType || 'default';

        return AVRequest('statuses', null, null, 'POST', data, options);
      }).then(function (response) {
        _this.id = response.objectId;
        _this.createdAt = AV._parseDate(response.createdAt);
        return _this;
      });
    },

    _finishFetch: function _finishFetch(serverData) {
      this.id = serverData.objectId;
      this.createdAt = AV._parseDate(serverData.createdAt);
      this.updatedAt = AV._parseDate(serverData.updatedAt);
      this.messageId = serverData.messageId;
      delete serverData.messageId;
      delete serverData.objectId;
      delete serverData.createdAt;
      delete serverData.updatedAt;
      this.data = AV._decode(serverData);
    }
  };

  /**
   * Send a status to current signined user's followers.
   * @since 0.3.0
   * @param {AV.Status} status  A status object to be send to followers.
   * @param {AuthOptions} options
   * @return {Promise} A promise that is fulfilled when the send
   *     completes.
   * @example
   *     var status = new AVStatus('image url', 'a message');
   *     AV.Status.sendStatusToFollowers(status).then(function(){
   *              //send status successfully.
   *      }, function(err){
   *             //an error threw.
   *             console.dir(err);
   *      });
   */
  AV.Status.sendStatusToFollowers = function (status) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    if (!options.sessionToken && !AV.User.current()) {
      throw new Error('Please signin an user.');
    }
    return getUserPointer(options).then(function (currUser) {
      var query = {};
      query.className = '_Follower';
      query.keys = 'follower';
      query.where = { user: currUser };
      var data = {};
      data.query = query;
      status.data = status.data || {};
      status.data.source = status.data.source || currUser;
      data.data = status._getDataJSON();
      data.inboxType = status.inboxType || 'default';

      var request = AVRequest('statuses', null, null, 'POST', data, options);
      return request.then(function (response) {
        status.id = response.objectId;
        status.createdAt = AV._parseDate(response.createdAt);
        return status;
      });
    });
  };

  /**
   * <p>Send  a status from current signined user to other user's private status inbox.</p>
   * @since 0.3.0
   * @param {AV.Status} status  A status object to be send to followers.
   * @param {String} target The target user or user's objectId.
   * @param {AuthOptions} options
   * @return {Promise} A promise that is fulfilled when the send
   *     completes.
   * @example
   *     // send a private status to user '52e84e47e4b0f8de283b079b'
   *     var status = new AVStatus('image url', 'a message');
   *     AV.Status.sendPrivateStatus(status, '52e84e47e4b0f8de283b079b').then(function(){
   *              //send status successfully.
   *      }, function(err){
   *             //an error threw.
   *             console.dir(err);
   *      });
   */
  AV.Status.sendPrivateStatus = function (status, target) {
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    if (!options.sessionToken && !AV.User.current()) {
      throw new Error('Please signin an user.');
    }
    if (!target) {
      throw new Error("Invalid target user.");
    }
    var userObjectId = _.isString(target) ? target : target.id;
    if (!userObjectId) {
      throw new Error("Invalid target user.");
    }
    return getUserPointer(options).then(function (currUser) {
      var query = {};
      query.className = '_User';
      query.where = { objectId: userObjectId };
      var data = {};
      data.query = query;
      status.data = status.data || {};
      status.data.source = status.data.source || currUser;
      data.data = status._getDataJSON();
      data.inboxType = 'private';
      status.inboxType = 'private';

      var request = AVRequest('statuses', null, null, 'POST', data, options);
      return request.then(function (response) {
        status.id = response.objectId;
        status.createdAt = AV._parseDate(response.createdAt);
        return status;
      });
    });
  };

  /**
   * Count unread statuses in someone's inbox.
   * @since 0.3.0
   * @param {Object} owner The status owner.
   * @param {String} inboxType The inbox type, 'default' by default.
   * @param {AuthOptions} options
   * @return {Promise} A promise that is fulfilled when the count
   *     completes.
   * @example
   *  AV.Status.countUnreadStatuses(AV.User.current()).then(function(response){
   *    console.log(response.unread); //unread statuses number.
   *    console.log(response.total);  //total statuses number.
   *  });
   */
  AV.Status.countUnreadStatuses = function (owner) {
    var inboxType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'default';
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    if (!_.isString(inboxType)) options = inboxType;
    if (!options.sessionToken && owner == null && !AV.User.current()) {
      throw new Error('Please signin an user or pass the owner objectId.');
    }
    return getUser(options).then(function (owner) {
      var params = {};
      params.inboxType = AV._encode(inboxType);
      params.owner = AV._encode(owner);
      return AVRequest('subscribe/statuses/count', null, null, 'GET', params, options);
    });
  };

  /**
   * reset unread statuses count in someone's inbox.
   * @since 2.1.0
   * @param {Object} owner The status owner.
   * @param {String} inboxType The inbox type, 'default' by default.
   * @param {AuthOptions} options
   * @return {Promise} A promise that is fulfilled when the reset
   *     completes.
   * @example
   *  AV.Status.resetUnreadCount(AV.User.current()).then(function(response){
   *    console.log(response.unread); //unread statuses number.
   *    console.log(response.total);  //total statuses number.
   *  });
   */
  AV.Status.resetUnreadCount = function (owner) {
    var inboxType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'default';
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    if (!_.isString(inboxType)) options = inboxType;
    if (!options.sessionToken && owner == null && !AV.User.current()) {
      throw new Error('Please signin an user or pass the owner objectId.');
    }
    return getUser(options).then(function (owner) {
      var params = {};
      params.inboxType = AV._encode(inboxType);
      params.owner = AV._encode(owner);
      return AVRequest('subscribe/statuses/resetUnreadCount', null, null, 'POST', params, options);
    });
  };

  /**
   * Create a status query to find someone's published statuses.
   * @since 0.3.0
   * @param {Object} source The status source.
   * @return {AV.Query} The query object for status.
   * @example
   *   //Find current user's published statuses.
   *   var query = AV.Status.statusQuery(AV.User.current());
   *   query.find().then(function(statuses){
   *      //process statuses
   *   });
   */
  AV.Status.statusQuery = function (source) {
    var query = new AV.Query('_Status');
    if (source) {
      query.equalTo('source', source);
    }
    return query;
  };

  /**
   * <p>AV.InboxQuery defines a query that is used to fetch somebody's inbox statuses.</p>
   * @class
   */
  AV.InboxQuery = AV.Query._extend( /** @lends AV.InboxQuery.prototype */{
    _objectClass: AV.Status,
    _sinceId: 0,
    _maxId: 0,
    _inboxType: 'default',
    _owner: null,
    _newObject: function _newObject() {
      return new AV.Status();
    },
    _createRequest: function _createRequest(params, options) {
      return AVRequest('subscribe/statuses', null, null, 'GET', params || this.toJSON(), options);
    },

    /**
     * Sets the messageId of results to skip before returning any results.
     * This is useful for pagination.
     * Default is zero.
     * @param {Number} n the mesage id.
     * @return {AV.InboxQuery} Returns the query, so you can chain this call.
     */
    sinceId: function sinceId(id) {
      this._sinceId = id;
      return this;
    },
    /**
     * Sets the maximal messageId of results。
     * This is useful for pagination.
     * Default is zero that is no limition.
     * @param {Number} n the mesage id.
     * @return {AV.InboxQuery} Returns the query, so you can chain this call.
     */
    maxId: function maxId(id) {
      this._maxId = id;
      return this;
    },
    /**
     * Sets the owner of the querying inbox.
     * @param {Object} owner The inbox owner.
     * @return {AV.InboxQuery} Returns the query, so you can chain this call.
     */
    owner: function owner(_owner) {
      this._owner = _owner;
      return this;
    },
    /**
     * Sets the querying inbox type.default is 'default'.
     * @param {Object} owner The inbox type.
     * @return {AV.InboxQuery} Returns the query, so you can chain this call.
     */
    inboxType: function inboxType(type) {
      this._inboxType = type;
      return this;
    },
    toJSON: function toJSON() {
      var params = AV.InboxQuery.__super__.toJSON.call(this);
      params.owner = AV._encode(this._owner);
      params.inboxType = AV._encode(this._inboxType);
      params.sinceId = AV._encode(this._sinceId);
      params.maxId = AV._encode(this._maxId);
      return params;
    }
  });

  /**
   * Create a inbox status query to find someone's inbox statuses.
   * @since 0.3.0
   * @param {Object} owner The inbox's owner
   * @param {String} inboxType The inbox type,'default' by default.
   * @return {AV.InboxQuery} The inbox query object.
   * @see AV.InboxQuery
   * @example
   *   //Find current user's default inbox statuses.
   *   var query = AV.Status.inboxQuery(AV.User.current());
   *   //find the statuses after the last message id
   *   query.sinceId(lastMessageId);
   *   query.find().then(function(statuses){
   *      //process statuses
   *   });
   */
  AV.Status.inboxQuery = function (owner, inboxType) {
    var query = new AV.InboxQuery(AV.Status);
    if (owner) {
      query._owner = owner;
    }
    if (inboxType) {
      query._inboxType = inboxType;
    }
    return query;
  };
};