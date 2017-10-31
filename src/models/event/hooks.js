const Promise       = require('bluebird');
const { NODE_ENV }  = require('../../config');

module.exports = function(models, Event) {
  function wrapHookHandler(event, callback) {
    /* eslint-disable promise/no-callback-in-promise */
    return Event.scope('event-category')
      .findById(event.id)
      .then(callback)
      .thenReturn(true)
      .tapCatch(console.error);
    /* eslint-enable promise/no-callback-in-promise */
  }

  Event.hook('afterCreate', (event, options) => {
    if ( NODE_ENV === 'test' ) {
      return event;
    }

    return wrapHookHandler(event, (event) => {
      return event.googleCreate(options);
    });
  });

  Event.hook('afterUpdate', (event, options) => {
    const {eventable, EventableId} = event;

    if ( NODE_ENV === 'test' ) {
      return event;
    }

    return wrapHookHandler(event, (event) => {
      return Promise.all([
          // TODO: remove these non-generic scopes doing here??
          models[eventable].scope(`eventable${eventable}`)
            .findOne({
              where: { id: EventableId },
              include: [{ model: models.Client }, { model: models.OrderItem }],
            }),
          event.googleEventId != null && event.googleUpdate(),
        ])
        .then(([eventableInstance]) => {
          return eventableInstance.handleEventUpdate &&
            eventableInstance.handleEventUpdate(event, options);
        });
    });
  });

  Event.hook('afterDelete', (event) => {
    if ( event.googleEventId != null ) {
      return wrapHookHandler(event, (event) => {
        return event.googleDelete();
      });
    }

    return true;
  });

  Event.hook('afterRestore', (event, options) => {
    if ( event.googleEventId != null ) {
      return wrapHookHandler(event, (event) => {
        return event.googleCreate(options);
      });
    }

    return true;
  });
};
