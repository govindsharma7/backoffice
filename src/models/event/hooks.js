module.exports = function({ Event }) {
  Event.afterCreateHandler = function(event) {
    return Event.zapCreatedOrUpdated( event );
  };
  Event.hook('afterCreate', (event, options) =>
    Event.afterCreateHandler(event, options)
  );

  Event.afterUpdateHandler = async function({ id }) {
    const event = await Event.findById(id);

    return Event.zapCreatedOrUpdated({ event });
  };
  Event.hook('afterUpdate', (event, options) =>
    Event.afterUpdateHandler(event, options)
  );

  Event.afterDestroyHandler = function(event) {
    return Event.zapDeleted({ event });
  };
  Event.hook('afterDelete', (event, options) =>
    Event.afterDeleteHandler(event, options)
  );
};
